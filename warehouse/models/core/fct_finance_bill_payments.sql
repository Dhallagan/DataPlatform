-- =============================================================================
-- FACT: Finance Bill Payments
-- =============================================================================
-- Grain: 1 row per bill payment
-- =============================================================================

SELECT
    bill_payment_id,
    organization_id,
    bill_id,
    payment_method,
    amount_usd,
    currency,
    paid_at,
    DATE(paid_at) AS paid_date,
    DATE_TRUNC('month', COALESCE(paid_at, created_at))::DATE AS paid_month,
    status AS payment_status,
    external_payment_id,
    created_at,
    _loaded_at
FROM {{ ref('stg_finance_bill_payments') }}
