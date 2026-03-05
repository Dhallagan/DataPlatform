-- =============================================================================
-- WORKFLOW TABLE: Action Log
-- =============================================================================
-- Grain: 1 row per executed action
-- Purpose: Auditable log of workflow actions taken from signals.
-- =============================================================================

{{ config(materialized='table') }}

WITH queue AS (
    SELECT
        task_id,
        signal_id,
        organization_id,
        action_type,
        created_at
    FROM {{ ref('growth_task_queue') }}
),

activity_events AS (
    SELECT
        activity_id,
        occurred_at,
        subject,
        outcome,
        legacy_owner_user_id
    FROM {{ ref('stg_gtm_activities') }}
    WHERE LOWER(COALESCE(activity_type, '')) = 'workflow_execution'
),

parsed_events AS (
    SELECT
        activity_id,
        occurred_at,
        REGEXP_EXTRACT(subject, 'organization_id=([0-9a-f-]+)', 1) AS organization_id,
        REGEXP_EXTRACT(subject, 'action_type=([^|\\s]+)', 1) AS action_type,
        REGEXP_EXTRACT(subject, 'destination=([^|\\s]+)', 1) AS destination_system,
        NULLIF(REGEXP_EXTRACT(subject, 'error=([^|\\s]+)', 1), '') AS parsed_error_message,
        LOWER(COALESCE(outcome, 'success')) AS outcome_status,
        legacy_owner_user_id
    FROM activity_events
),

matched AS (
    SELECT
        p.activity_id AS action_id,
        q.signal_id,
        q.task_id,
        q.organization_id,
        COALESCE(NULLIF(p.action_type, ''), q.action_type) AS action_type,
        COALESCE(NULLIF(p.destination_system, ''), 'hubspot') AS destination_system,
        'workflow_agent' AS actor_type,
        COALESCE(NULLIF(p.legacy_owner_user_id, ''), 'workflow-system') AS actor_id,
        p.occurred_at AS executed_at,
        CASE WHEN p.outcome_status IN ('failed', 'error') THEN 'failed' ELSE 'success' END AS status,
        CASE
            WHEN p.outcome_status IN ('failed', 'error') THEN COALESCE(p.parsed_error_message, 'workflow_execution_failed')
            ELSE NULL
        END AS error_message,
        p.outcome_status AS outcome_label
    FROM queue q
    INNER JOIN parsed_events p
        ON q.organization_id = p.organization_id
       AND CAST(q.created_at AS DATE) = CAST(p.occurred_at AS DATE)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY q.task_id ORDER BY p.occurred_at DESC, p.activity_id) = 1
)

SELECT
    action_id,
    signal_id,
    task_id,
    organization_id,
    action_type,
    destination_system,
    actor_type,
    actor_id,
    executed_at,
    status,
    error_message,
    outcome_label,
    CURRENT_TIMESTAMP AS _loaded_at
FROM matched
