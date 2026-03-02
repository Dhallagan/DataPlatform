-- =============================================================================
-- STAGING: Finance Reimbursements
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_finance', 'reimbursements') }}
),

staged AS (
    SELECT
        id::TEXT                          AS reimbursement_id,
        organization_id::TEXT             AS organization_id,
        submitted_by_user_id::TEXT        AS submitted_by_user_id,
        department_id::TEXT               AS department_id,
        vendor_id::TEXT                   AS vendor_id,
        amount_usd::DECIMAL(12,2)         AS amount_usd,
        UPPER(TRIM(currency))::TEXT       AS currency,
        LOWER(TRIM(status))::TEXT         AS status,
        expense_date::DATE                AS expense_date,
        submitted_at::TIMESTAMP           AS submitted_at,
        approved_at::TIMESTAMP            AS approved_at,
        paid_at::TIMESTAMP                AS paid_at,
        memo::TEXT                        AS memo,
        created_at::TIMESTAMP             AS created_at,
        updated_at::TIMESTAMP             AS updated_at,
        CURRENT_TIMESTAMP                 AS _loaded_at
    FROM source
)

SELECT * FROM staged
