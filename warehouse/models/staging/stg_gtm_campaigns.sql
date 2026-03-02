-- =============================================================================
-- STAGING: GTM Campaigns
-- =============================================================================
-- Source: bronze_supabase_gtm.campaigns
-- Grain: 1 row per campaign
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_gtm', 'campaigns') }}
),

staged AS (
    SELECT
        id::TEXT                            AS campaign_id,
        name::TEXT                          AS campaign_name,
        LOWER(TRIM(channel))::TEXT          AS channel,
        objective::TEXT                     AS objective,
        LOWER(TRIM(status))::TEXT           AS campaign_status,
        budget_usd::DECIMAL(12,2)           AS budget_usd,
        start_date::DATE                    AS start_date,
        end_date::DATE                      AS end_date,
        owner_user_id::TEXT                 AS owner_user_id,
        created_at::TIMESTAMP               AS created_at,
        updated_at::TIMESTAMP               AS updated_at,
        CURRENT_TIMESTAMP                   AS _loaded_at
    FROM source
)

SELECT * FROM staged
