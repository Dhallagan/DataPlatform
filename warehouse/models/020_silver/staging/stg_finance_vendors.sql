-- =============================================================================
-- STAGING: Finance Vendors
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_finance', 'vendors') }}
),

staged AS (
    SELECT
        id::TEXT                        AS vendor_id,
        organization_id::TEXT           AS organization_id,
        vendor_name::TEXT               AS vendor_name,
        LOWER(TRIM(category))::TEXT     AS category,
        LOWER(TRIM(status))::TEXT       AS status,
        LOWER(TRIM(payment_terms))::TEXT AS payment_terms,
        LOWER(TRIM(risk_level))::TEXT   AS risk_level,
        UPPER(TRIM(country))::TEXT      AS country,
        UPPER(TRIM(currency))::TEXT     AS currency,
        created_at::TIMESTAMP           AS created_at,
        updated_at::TIMESTAMP           AS updated_at,
        CURRENT_TIMESTAMP               AS _loaded_at
    FROM source
)

SELECT * FROM staged
