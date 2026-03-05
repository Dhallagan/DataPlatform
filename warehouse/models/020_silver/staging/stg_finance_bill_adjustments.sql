-- =============================================================================
-- STAGING: Finance Bill Adjustments
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_finance', 'bill_adjustments') }}
),

staged AS (
    SELECT
        id::TEXT                             AS bill_adjustment_id,
        organization_id::TEXT                AS organization_id,
        bill_id::TEXT                        AS bill_id,
        LOWER(TRIM(adjustment_type))::TEXT   AS adjustment_type,
        LOWER(TRIM(direction))::TEXT         AS direction,
        amount_usd::DECIMAL(12,2)            AS amount_usd,
        UPPER(TRIM(currency))::TEXT          AS currency,
        reason::TEXT                         AS reason,
        adjusted_at::TIMESTAMP               AS adjusted_at,
        created_by_user_id::TEXT             AS created_by_user_id,
        created_at::TIMESTAMP                AS created_at,
        CURRENT_TIMESTAMP                    AS _loaded_at
    FROM source
)

SELECT * FROM staged
