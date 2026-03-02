-- =============================================================================
-- STAGING: GTM Lead Touches
-- =============================================================================
-- Source: bronze_supabase_gtm.lead_touches
-- Grain: 1 row per touch event
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_gtm', 'lead_touches') }}
),

staged AS (
    SELECT
        id::TEXT                            AS touch_id,
        lead_id::TEXT                       AS lead_id,
        campaign_id::TEXT                   AS campaign_id,
        LOWER(TRIM(touch_type))::TEXT       AS touch_type,
        touch_at::TIMESTAMP                 AS touch_at,
        channel::TEXT                       AS channel,
        metadata                            AS metadata,
        created_at::TIMESTAMP               AS created_at,
        CURRENT_TIMESTAMP                   AS _loaded_at
    FROM source
)

SELECT * FROM staged
