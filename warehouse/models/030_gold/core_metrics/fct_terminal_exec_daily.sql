{{ config(alias='exec_daily', schema='term') }}

-- =============================================================================
-- FACT VIEW: Executive Terminal Daily
-- =============================================================================
-- Grain: 1 row per metric_date
-- Purpose: Unified daily fact spine for executive terminal trend widgets
-- =============================================================================

WITH growth AS (
    SELECT
        metric_date,
        total_sessions,
        new_organizations,
        new_users,
        activation_rate_7d_pct
    FROM {{ ref('growth_daily') }}
),

product AS (
    SELECT
        metric_date,
        success_rate_pct,
        proxy_adoption_pct,
        stealth_adoption_pct
    FROM {{ ref('product_daily') }}
),

pipeline AS (
    SELECT
        as_of_date AS metric_date,
        open_pipeline_usd,
        won_revenue_usd,
        lead_conversion_rate_pct,
        opportunity_win_rate_pct
    FROM {{ ref('gtm_pipeline_snapshot') }}
),

mrr AS (
    SELECT
        as_of_date AS metric_date,
        total_mrr_usd
    FROM {{ ref('mrr') }}
),

budget_daily AS (
    SELECT
        (budget_month + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS metric_date,
        SUM(budget_allocated_usd) AS budget_allocated_usd,
        SUM(actual_spend_usd) AS actual_spend_usd,
        SUM(budget_variance_usd) AS budget_variance_usd,
        ROUND(100.0 * SUM(actual_spend_usd) / NULLIF(SUM(budget_allocated_usd), 0), 2) AS budget_utilization_ratio
    FROM {{ ref('finance_budget_vs_actual_monthly') }}
    GROUP BY 1
),

calendar AS (
    SELECT metric_date FROM growth
    UNION
    SELECT metric_date FROM product
    UNION
    SELECT metric_date FROM pipeline
    UNION
    SELECT metric_date FROM mrr
    UNION
    SELECT metric_date FROM budget_daily
)

SELECT
    c.metric_date,
    g.total_sessions,
    g.new_organizations,
    g.new_users,
    g.activation_rate_7d_pct,
    p.success_rate_pct,
    p.proxy_adoption_pct,
    p.stealth_adoption_pct,
    pl.open_pipeline_usd,
    pl.won_revenue_usd,
    pl.lead_conversion_rate_pct,
    pl.opportunity_win_rate_pct,
    m.total_mrr_usd,
    b.budget_allocated_usd,
    b.actual_spend_usd,
    b.budget_variance_usd,
    b.budget_utilization_ratio,
    CURRENT_TIMESTAMP AS _loaded_at
FROM calendar c
LEFT JOIN growth g ON c.metric_date = g.metric_date
LEFT JOIN product p ON c.metric_date = p.metric_date
LEFT JOIN pipeline pl ON c.metric_date = pl.metric_date
LEFT JOIN mrr m ON c.metric_date = m.metric_date
LEFT JOIN budget_daily b ON c.metric_date = b.metric_date
ORDER BY c.metric_date DESC
