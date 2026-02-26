-- =============================================================================
-- FACT: Session Events
-- =============================================================================
-- Grain: 1 row per event
-- Purpose: Canonical event fact for behavioral analytics
-- =============================================================================

WITH events AS (
    SELECT
        id::TEXT AS event_id,
        session_id::TEXT AS run_id,
        LOWER(TRIM(event_type))::TEXT AS event_name,
        timestamp::TIMESTAMP AS event_ts,
        page_url::TEXT AS page_url,
        page_title::TEXT AS page_title,
        _synced_at::TIMESTAMP AS _source_synced_at
    FROM {{ source('bronze_supabase', 'session_events') }}
),

runs AS (
    SELECT
        run_id,
        organization_id,
        project_id
    FROM {{ ref('fct_browser_run') }}
)

SELECT
    e.event_id,
    e.event_name,
    e.event_ts,
    e.run_id,
    r.organization_id,
    r.project_id,
    e.page_url,
    e.page_title,
    e._source_synced_at,
    CURRENT_TIMESTAMP AS _loaded_at
FROM events e
LEFT JOIN runs r ON e.run_id = r.run_id
