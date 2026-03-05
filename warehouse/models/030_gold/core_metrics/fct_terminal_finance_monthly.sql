{{ config(alias='finance_monthly', schema='term') }}

-- =============================================================================
-- FACT VIEW: Finance Terminal Monthly
-- =============================================================================
-- Grain: 1 row per metric_month
-- Purpose: Cohesive monthly finance trend inputs for spend + revenue quality
-- =============================================================================

WITH revenue AS (
    SELECT
        revenue_month AS metric_month,
        SUM(realized_revenue_usd) AS realized_revenue_usd,
        SUM(pending_revenue_usd) AS pending_revenue_usd,
        AVG(collection_rate_pct) AS collection_rate_pct,
        SUM(open_invoice_count) AS open_invoice_count,
        SUM(paid_invoice_count) AS paid_invoice_count
    FROM {{ ref('monthly_revenue') }}
    GROUP BY 1
),

budget AS (
    SELECT
        budget_month AS metric_month,
        SUM(budget_allocated_usd) AS budget_allocated_usd,
        SUM(actual_spend_usd) AS actual_spend_usd,
        SUM(budget_variance_usd) AS budget_variance_usd,
        ROUND(100.0 * SUM(actual_spend_usd) / NULLIF(SUM(budget_allocated_usd), 0), 2) AS budget_utilization_ratio,
        SUM(ap_open_usd) AS ap_open_usd
    FROM {{ ref('finance_budget_vs_actual_monthly') }}
    GROUP BY 1
),

spend AS (
    SELECT
        spend_month AS metric_month,
        SUM(spend_usd) AS total_spend_usd,
        SUM(record_count) AS spend_record_count
    FROM {{ ref('ramp_spend_monthly') }}
    GROUP BY 1
),

calendar AS (
    SELECT metric_month FROM revenue
    UNION
    SELECT metric_month FROM budget
    UNION
    SELECT metric_month FROM spend
)

SELECT
    c.metric_month,
    r.realized_revenue_usd,
    r.pending_revenue_usd,
    r.collection_rate_pct,
    r.open_invoice_count,
    r.paid_invoice_count,
    b.budget_allocated_usd,
    b.actual_spend_usd,
    b.budget_variance_usd,
    b.budget_utilization_ratio,
    b.ap_open_usd,
    s.total_spend_usd,
    s.spend_record_count,
    CURRENT_TIMESTAMP AS _loaded_at
FROM calendar c
LEFT JOIN revenue r ON c.metric_month = r.metric_month
LEFT JOIN budget b ON c.metric_month = b.metric_month
LEFT JOIN spend s ON c.metric_month = s.metric_month
ORDER BY c.metric_month DESC
