-- =============================================================================
-- STAGING: Finance Bills
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_finance', 'bills') }}
),

staged AS (
    SELECT
        id::TEXT                          AS bill_id,
        organization_id::TEXT             AS organization_id,
        vendor_id::TEXT                   AS vendor_id,
        department_id::TEXT               AS department_id,
        bill_number::TEXT                 AS bill_number,
        bill_date::DATE                   AS bill_date,
        due_date::DATE                    AS due_date,
        amount_usd::DECIMAL(12,2)         AS amount_usd,
        UPPER(TRIM(currency))::TEXT       AS currency,
        LOWER(TRIM(status))::TEXT         AS status,
        approved_by_user_id::TEXT         AS approved_by_user_id,
        memo::TEXT                        AS memo,
        created_at::TIMESTAMP             AS created_at,
        updated_at::TIMESTAMP             AS updated_at,
        CURRENT_TIMESTAMP                 AS _loaded_at
    FROM source
)

SELECT * FROM staged
