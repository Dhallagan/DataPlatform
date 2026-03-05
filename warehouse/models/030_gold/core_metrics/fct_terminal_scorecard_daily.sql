{{ config(alias='scorecard_daily', schema='term') }}

-- =============================================================================
-- FACT TABLE: Terminal Scorecard Daily (15 Metrics)
-- =============================================================================
-- Grain: 1 row per as_of_date
-- Purpose: Canonical executive scorecard for the terminal overview.
-- =============================================================================

WITH mrr AS (
    SELECT
        as_of_date,
        total_mrr_usd,
        total_paying_customers,
        arpu_usd
    FROM {{ ref('mrr') }}
),

latest_revenue_month AS (
    SELECT MAX(revenue_month) AS revenue_month
    FROM {{ ref('monthly_revenue') }}
),

revenue AS (
    SELECT
        r.revenue_month,
        SUM(r.realized_revenue_usd) AS realized_revenue_usd_latest_month,
        CASE
            WHEN SUM(r.gross_revenue_usd) = 0 THEN 0
            ELSE ROUND(
                100.0 * SUM(r.realized_revenue_usd) / SUM(r.gross_revenue_usd),
                2
            )
        END AS collection_rate_pct_latest_month,
        SUM(r.open_invoice_count) AS open_invoice_count_latest_month
    FROM {{ ref('monthly_revenue') }} r
    INNER JOIN latest_revenue_month lrm
        ON r.revenue_month = lrm.revenue_month
    GROUP BY 1
),

pipeline AS (
    SELECT
        as_of_date,
        open_pipeline_usd,
        opportunity_win_rate_pct,
        lead_conversion_rate_pct
    FROM {{ ref('gtm_pipeline_snapshot') }}
),

funnel_30d AS (
    SELECT
        SUM(leads_created) AS leads_created_30d,
        CASE
            WHEN SUM(leads_created) = 0 THEN 0
            ELSE ROUND(100.0 * SUM(opportunities_created) / SUM(leads_created), 2)
        END AS lead_to_opp_rate_pct_30d
    FROM {{ ref('gtm_funnel_daily') }}
    WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
),

engineering_30d AS (
    SELECT
        sessions_30d,
        avg_success_rate_pct_30d,
        avg_p95_duration_seconds_30d,
        avg_errors_per_1k_sessions_30d
    FROM {{ ref('engineering_kpis') }}
)

SELECT
    COALESCE(m.as_of_date, p.as_of_date, CURRENT_DATE) AS metric_date,
    r.revenue_month,
    m.total_mrr_usd,
    m.total_paying_customers,
    m.arpu_usd,
    r.realized_revenue_usd_latest_month,
    r.collection_rate_pct_latest_month,
    r.open_invoice_count_latest_month,
    p.open_pipeline_usd,
    p.opportunity_win_rate_pct,
    p.lead_conversion_rate_pct,
    f.leads_created_30d,
    f.lead_to_opp_rate_pct_30d,
    e.sessions_30d,
    e.avg_success_rate_pct_30d,
    e.avg_p95_duration_seconds_30d,
    e.avg_errors_per_1k_sessions_30d,
    CURRENT_TIMESTAMP AS _loaded_at
FROM mrr m
CROSS JOIN revenue r
CROSS JOIN pipeline p
CROSS JOIN funnel_30d f
CROSS JOIN engineering_30d e
