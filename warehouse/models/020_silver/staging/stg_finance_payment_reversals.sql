-- =============================================================================
-- STAGING: Finance Payment Reversals
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_finance', 'payment_reversals') }}
),

staged AS (
    SELECT
        id::TEXT                             AS payment_reversal_id,
        organization_id::TEXT                AS organization_id,
        original_payment_id::TEXT            AS original_payment_id,
        bill_id::TEXT                        AS bill_id,
        reversal_amount_usd::DECIMAL(12,2)   AS reversal_amount_usd,
        UPPER(TRIM(currency))::TEXT          AS currency,
        LOWER(TRIM(status))::TEXT            AS status,
        reversal_reason::TEXT                AS reversal_reason,
        reversed_at::TIMESTAMP               AS reversed_at,
        created_by_user_id::TEXT             AS created_by_user_id,
        created_at::TIMESTAMP                AS created_at,
        CURRENT_TIMESTAMP                    AS _loaded_at
    FROM source
)

SELECT * FROM staged
