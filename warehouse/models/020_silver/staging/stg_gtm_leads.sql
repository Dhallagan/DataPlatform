-- =============================================================================
-- STAGING: GTM Leads
-- =============================================================================
-- Source: bronze_supabase_gtm.leads
-- Grain: 1 row per lead
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_gtm', 'leads') }}
),

staged AS (
    SELECT
        id::TEXT                            AS lead_id,
        account_id::TEXT                    AS account_id,
        contact_id::TEXT                    AS contact_id,
        LOWER(TRIM(lead_source))::TEXT      AS lead_source,
        LOWER(TRIM(lead_status))::TEXT      AS lead_status,
        source_detail::TEXT                 AS source_detail,
        score::INTEGER                      AS score,
        {{ source_column_or_null('bronze_supabase_gtm', 'leads', 'owner_employee_id', 'TEXT') }} AS owner_employee_id,
        owner_user_id::TEXT                 AS legacy_owner_user_id,
        first_touch_at::TIMESTAMP           AS first_touch_at,
        converted_at::TIMESTAMP             AS converted_at,
        created_at::TIMESTAMP               AS created_at,
        updated_at::TIMESTAMP               AS updated_at,
        CURRENT_TIMESTAMP                   AS _loaded_at
    FROM source
)

SELECT * FROM staged
