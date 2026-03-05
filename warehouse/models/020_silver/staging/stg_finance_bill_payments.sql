-- =============================================================================
-- STAGING: Finance Bill Payments
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_finance', 'bill_payments') }}
),

staged AS (
    SELECT
        id::TEXT                          AS bill_payment_id,
        organization_id::TEXT             AS organization_id,
        bill_id::TEXT                     AS bill_id,
        LOWER(TRIM(payment_method))::TEXT AS payment_method,
        amount_usd::DECIMAL(12,2)         AS amount_usd,
        UPPER(TRIM(currency))::TEXT       AS currency,
        paid_at::TIMESTAMP                AS paid_at,
        LOWER(TRIM(status))::TEXT         AS status,
        external_payment_id::TEXT         AS external_payment_id,
        created_at::TIMESTAMP             AS created_at,
        CURRENT_TIMESTAMP                 AS _loaded_at
    FROM source
)

SELECT * FROM staged
