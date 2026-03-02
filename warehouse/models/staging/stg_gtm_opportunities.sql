-- =============================================================================
-- STAGING: GTM Opportunities
-- =============================================================================
-- Source: bronze_supabase_gtm.opportunities
-- Grain: 1 row per opportunity
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_gtm', 'opportunities') }}
),

staged AS (
    SELECT
        id::TEXT                                AS opportunity_id,
        account_id::TEXT                        AS account_id,
        primary_contact_id::TEXT                AS primary_contact_id,
        originating_lead_id::TEXT               AS originating_lead_id,
        opportunity_name::TEXT                  AS opportunity_name,
        LOWER(TRIM(stage))::TEXT                AS stage,
        amount_usd::DECIMAL(12,2)               AS amount_usd,
        LOWER(TRIM(forecast_category))::TEXT    AS forecast_category,
        expected_close_date::DATE               AS expected_close_date,
        closed_at::TIMESTAMP                    AS closed_at,
        is_won::BOOLEAN                         AS is_won,
        loss_reason::TEXT                       AS loss_reason,
        owner_user_id::TEXT                     AS owner_user_id,
        created_at::TIMESTAMP                   AS created_at,
        updated_at::TIMESTAMP                   AS updated_at,
        CURRENT_TIMESTAMP                       AS _loaded_at
    FROM source
)

SELECT * FROM staged
