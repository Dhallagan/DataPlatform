{{ config(alias='fct_fin_transactions') }}

-- =============================================================================
-- FACT: Finance Transactions
-- =============================================================================
-- Grain: 1 row per card transaction
-- =============================================================================

SELECT
    transaction_id,
    organization_id,
    card_id,
    vendor_id,
    department_id,
    merchant_name,
    merchant_category,
    amount_usd,
    currency,
    transaction_type,
    status AS transaction_status,
    transaction_at,
    DATE(transaction_at) AS transaction_date,
    DATE_TRUNC('month', transaction_at)::DATE AS transaction_month,
    settled_at,
    memo,
    receipt_url,
    created_by_user_id,
    created_at,
    updated_at,
    _loaded_at
FROM {{ ref('stg_finance_transactions') }}
