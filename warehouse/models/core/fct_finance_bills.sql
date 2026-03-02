-- =============================================================================
-- FACT: Finance Bills
-- =============================================================================
-- Grain: 1 row per AP bill
-- =============================================================================

SELECT
    bill_id,
    organization_id,
    vendor_id,
    department_id,
    bill_number,
    bill_date,
    DATE_TRUNC('month', bill_date)::DATE AS bill_month,
    due_date,
    amount_usd,
    currency,
    status AS bill_status,
    approved_by_user_id,
    memo,
    created_at,
    updated_at,
    _loaded_at
FROM {{ ref('stg_finance_bills') }}
