{{ config(alias='fct_fin_payment_reversals') }}

-- =============================================================================
-- FACT: Finance Payment Reversals
-- =============================================================================
-- Grain: 1 row per payment reversal
-- =============================================================================

SELECT
    payment_reversal_id,
    organization_id,
    original_payment_id AS bill_payment_id,
    bill_id,
    reversal_amount_usd,
    currency,
    status AS reversal_status,
    reversal_reason,
    reversed_at,
    DATE(reversed_at) AS reversed_date,
    DATE_TRUNC('month', reversed_at)::DATE AS reversed_month,
    created_by_user_id,
    created_at,
    _loaded_at
FROM {{ ref('stg_finance_payment_reversals') }}
