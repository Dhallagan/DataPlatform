{{ config(alias='agg_firm_unit_economics_monthly') }}

-- =============================================================================
-- FACT TABLE: Firm Unit Economics Monthly
-- =============================================================================
-- Grain: 1 row per month
-- Purpose: Company-wide rollup of expected cost, revenue, utilization, and margin
-- =============================================================================

WITH customer_monthly AS (
    SELECT
        metric_month,
        organization_id,
        sessions_with_duration,
        total_session_hours,
        expected_cost_usd,
        realized_revenue_usd,
        entitled_hours_monthly_prorated,
        utilization_pct
    FROM {{ ref('customer_unit_economics_monthly') }}
),

rolled AS (
    SELECT
        metric_month,
        COUNT(DISTINCT organization_id) AS customer_count,
        COUNT(DISTINCT CASE WHEN sessions_with_duration > 0 THEN organization_id END) AS active_customer_count,
        SUM(sessions_with_duration) AS total_sessions_with_duration,
        SUM(total_session_hours) AS total_session_hours,
        SUM(expected_cost_usd) AS total_expected_cost_usd,
        SUM(COALESCE(realized_revenue_usd, 0)) AS total_realized_revenue_usd,
        SUM(CASE WHEN entitled_hours_monthly_prorated IS NOT NULL THEN entitled_hours_monthly_prorated ELSE 0 END) AS total_entitled_hours_prorated,
        AVG(utilization_pct) AS avg_customer_utilization_pct
    FROM customer_monthly
    GROUP BY 1
)

SELECT
    metric_month,
    customer_count,
    active_customer_count,
    total_sessions_with_duration,
    total_session_hours,
    total_expected_cost_usd,
    total_realized_revenue_usd,
    ROUND(
        total_realized_revenue_usd - total_expected_cost_usd,
        2
    ) AS gross_margin_usd,
    ROUND(
        (total_realized_revenue_usd - total_expected_cost_usd) / NULLIF(total_realized_revenue_usd, 0) * 100,
        2
    ) AS gross_margin_pct,
    ROUND(
        total_expected_cost_usd / NULLIF(total_session_hours, 0),
        4
    ) AS blended_expected_cost_per_hour_usd,
    total_entitled_hours_prorated,
    ROUND(
        total_session_hours / NULLIF(total_entitled_hours_prorated, 0) * 100,
        2
    ) AS utilization_pct,
    ROUND(avg_customer_utilization_pct, 2) AS avg_customer_utilization_pct,
    CURRENT_TIMESTAMP AS _loaded_at
FROM rolled
ORDER BY metric_month DESC
