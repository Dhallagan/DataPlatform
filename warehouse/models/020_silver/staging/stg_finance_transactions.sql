-- =============================================================================
-- STAGING: Finance Transactions
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_finance', 'transactions') }}
),

staged AS (
    SELECT
        id::TEXT                             AS transaction_id,
        organization_id::TEXT                AS organization_id,
        card_id::TEXT                        AS card_id,
        vendor_id::TEXT                      AS vendor_id,
        department_id::TEXT                  AS department_id,
        merchant_name::TEXT                  AS merchant_name,
        LOWER(TRIM(merchant_category))::TEXT AS merchant_category,
        amount_usd::DECIMAL(12,2)            AS amount_usd,
        UPPER(TRIM(currency))::TEXT          AS currency,
        LOWER(TRIM(transaction_type))::TEXT  AS transaction_type,
        LOWER(TRIM(status))::TEXT            AS status,
        transaction_at::TIMESTAMP            AS transaction_at,
        settled_at::TIMESTAMP                AS settled_at,
        memo::TEXT                           AS memo,
        receipt_url::TEXT                    AS receipt_url,
        created_by_user_id::TEXT             AS created_by_user_id,
        created_at::TIMESTAMP                AS created_at,
        updated_at::TIMESTAMP                AS updated_at,
        CURRENT_TIMESTAMP                    AS _loaded_at
    FROM source
)

SELECT * FROM staged
