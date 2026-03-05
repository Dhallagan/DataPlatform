-- =============================================================================
-- STAGING: Finance Cards
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_finance', 'cards') }}
),

staged AS (
    SELECT
        id::TEXT                        AS card_id,
        organization_id::TEXT           AS organization_id,
        card_last4::TEXT                AS card_last4,
        LOWER(TRIM(card_brand))::TEXT   AS card_brand,
        LOWER(TRIM(card_type))::TEXT    AS card_type,
        cardholder_user_id::TEXT        AS cardholder_user_id,
        department_id::TEXT             AS department_id,
        vendor_id::TEXT                 AS vendor_id,
        spend_limit_usd::DECIMAL(12,2)  AS spend_limit_usd,
        LOWER(TRIM(status))::TEXT       AS status,
        issued_at::TIMESTAMP            AS issued_at,
        frozen_at::TIMESTAMP            AS frozen_at,
        created_at::TIMESTAMP           AS created_at,
        updated_at::TIMESTAMP           AS updated_at,
        CURRENT_TIMESTAMP               AS _loaded_at
    FROM source
)

SELECT * FROM staged
