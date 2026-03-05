{{ config(alias='fct_browser_events') }}

-- =============================================================================
-- FACT: Session Events
-- =============================================================================
-- Grain: 1 row per event
-- Purpose: Canonical event fact for behavioral analytics
-- =============================================================================

WITH events AS (
    SELECT
        event_id,
        session_id,
        event_type,
        event_timestamp,
        page_url,
        page_title,
        _synced_at
    FROM {{ ref('stg_session_events') }}
),

sessions AS (
    SELECT
        session_id,
        organization_id,
        project_id
    FROM {{ ref('sessions') }}
)

SELECT
    e.event_id,
    e.event_type AS event_name,
    e.event_timestamp AS event_ts,
    e.session_id AS run_id,
    s.organization_id,
    s.project_id,
    e.page_url,
    e.page_title,
    e._synced_at AS _source_synced_at,
    CURRENT_TIMESTAMP AS _loaded_at
FROM events e
LEFT JOIN sessions s ON e.session_id = s.session_id
