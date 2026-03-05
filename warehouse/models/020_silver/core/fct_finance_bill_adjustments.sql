{{ config(alias='fct_fin_bill_adjustments') }}

-- =============================================================================
-- FACT: Finance Bill Adjustments
-- =============================================================================
-- Grain: 1 row per bill adjustment
-- =============================================================================

SELECT
    bill_adjustment_id,
    organization_id,
    bill_id,
    adjustment_type,
    direction,
    amount_usd,
    CASE WHEN direction = 'decrease' THEN -amount_usd ELSE amount_usd END AS signed_amount_usd,
    currency,
    reason,
    adjusted_at,
    DATE(adjusted_at) AS adjusted_date,
    DATE_TRUNC('month', adjusted_at)::DATE AS adjusted_month,
    created_by_user_id,
    created_at,
    _loaded_at
FROM {{ ref('stg_finance_bill_adjustments') }}
