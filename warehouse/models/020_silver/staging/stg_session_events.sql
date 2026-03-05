-- =============================================================================
-- STAGING: Session Events
-- =============================================================================
-- Source: bronze_supabase.session_events
-- Grain: 1 row per event
-- Purpose: Cleaned and typed session event records
-- =============================================================================

WITH source AS (
    SELECT
        id,
        session_id,
        event_type,
        event_data,
        page_url,
        page_title,
        timestamp,
        _synced_at
    FROM {{ source('bronze_supabase', 'session_events') }}
),

final AS (
    SELECT
        CAST(id AS TEXT) AS event_id,
        CAST(session_id AS TEXT) AS session_id,
        LOWER(TRIM(CAST(event_type AS TEXT))) AS event_type,
        event_data,
        CAST(page_url AS TEXT) AS page_url,
        CAST(page_title AS TEXT) AS page_title,
        CAST(timestamp AS TIMESTAMP) AS event_timestamp,
        CAST(_synced_at AS TIMESTAMP) AS _synced_at
    FROM source
)

SELECT * FROM final
