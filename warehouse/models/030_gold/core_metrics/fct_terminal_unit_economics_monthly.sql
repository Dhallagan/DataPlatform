{{ config(alias='unit_economics_monthly', schema='term') }}

-- =============================================================================
-- FACT VIEW: Unit Economics Terminal Monthly
-- =============================================================================
-- Grain: 1 row per metric_month
-- Purpose: Terminal-ready monthly blended economics rollup at firm level
-- =============================================================================

SELECT
    metric_month,
    customer_count,
    active_customer_count,
    total_sessions_with_duration,
    total_session_hours,
    total_expected_cost_usd,
    total_realized_revenue_usd,
    gross_margin_usd,
    gross_margin_pct,
    blended_expected_cost_per_hour_usd,
    total_entitled_hours_prorated,
    utilization_pct,
    avg_customer_utilization_pct,
    CURRENT_TIMESTAMP AS _loaded_at
FROM {{ ref('firm_unit_economics_monthly') }}
ORDER BY metric_month DESC
