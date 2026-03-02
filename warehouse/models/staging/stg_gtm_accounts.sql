-- =============================================================================
-- STAGING: GTM Accounts
-- =============================================================================
-- Source: bronze_supabase_gtm.accounts
-- Grain: 1 row per account
-- Purpose: Clean account records for GTM modeling
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_gtm', 'accounts') }}
),

staged AS (
    SELECT
        id::TEXT                            AS account_id,
        organization_id::TEXT               AS organization_id,
        name::TEXT                          AS account_name,
        website_domain::TEXT                AS website_domain,
        industry::TEXT                      AS industry,
        employee_band::TEXT                 AS employee_band,
        account_tier::TEXT                  AS account_tier,
        LOWER(TRIM(account_status))::TEXT   AS account_status,
        owner_user_id::TEXT                 AS owner_user_id,
        source_system::TEXT                 AS source_system,
        created_at::TIMESTAMP               AS created_at,
        updated_at::TIMESTAMP               AS updated_at,
        CURRENT_TIMESTAMP                   AS _loaded_at
    FROM source
)

SELECT * FROM staged
