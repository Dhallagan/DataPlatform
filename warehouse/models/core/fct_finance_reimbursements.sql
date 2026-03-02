-- =============================================================================
-- FACT: Finance Reimbursements
-- =============================================================================
-- Grain: 1 row per reimbursement request
-- =============================================================================

SELECT
    reimbursement_id,
    organization_id,
    submitted_by_user_id,
    department_id,
    vendor_id,
    amount_usd,
    currency,
    status AS reimbursement_status,
    expense_date,
    submitted_at,
    DATE(submitted_at) AS submitted_date,
    DATE_TRUNC('month', submitted_at)::DATE AS submitted_month,
    approved_at,
    paid_at,
    memo,
    created_at,
    updated_at,
    _loaded_at
FROM {{ ref('stg_finance_reimbursements') }}
