-- =============================================================================
-- WORKFLOW TABLE: Action Log
-- =============================================================================
-- Grain: 1 row per executed action
-- Purpose: Auditable log of workflow actions taken from signals.
-- =============================================================================

{{ config(materialized='table') }}

SELECT
    CAST(NULL AS TEXT) AS action_id,
    CAST(NULL AS TEXT) AS signal_id,
    CAST(NULL AS TEXT) AS task_id,
    CAST(NULL AS TEXT) AS organization_id,
    CAST(NULL AS TEXT) AS action_type,
    CAST(NULL AS TEXT) AS destination_system,
    CAST(NULL AS TEXT) AS actor_type,
    CAST(NULL AS TEXT) AS actor_id,
    CAST(NULL AS TIMESTAMP) AS executed_at,
    CAST(NULL AS TEXT) AS status,
    CAST(NULL AS TEXT) AS error_message,
    CAST(NULL AS TEXT) AS outcome_label,
    CURRENT_TIMESTAMP AS _loaded_at
WHERE 1 = 0
