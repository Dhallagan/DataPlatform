-- Ensure the 15-metric scorecard is a single valid snapshot row.
SELECT
    metric_date,
    revenue_month,
    total_mrr_usd,
    total_paying_customers,
    arpu_usd,
    realized_revenue_usd_latest_month,
    collection_rate_pct_latest_month,
    open_invoice_count_latest_month,
    open_pipeline_usd,
    opportunity_win_rate_pct,
    lead_conversion_rate_pct,
    leads_created_30d,
    lead_to_opp_rate_pct_30d,
    sessions_30d,
    avg_success_rate_pct_30d,
    avg_p95_duration_seconds_30d,
    avg_errors_per_1k_sessions_30d
FROM {{ ref('fct_terminal_scorecard_daily') }}
WHERE total_mrr_usd < 0
   OR total_paying_customers < 0
   OR arpu_usd < 0
   OR realized_revenue_usd_latest_month < 0
   OR collection_rate_pct_latest_month < 0
   OR collection_rate_pct_latest_month > 100
   OR open_invoice_count_latest_month < 0
   OR open_pipeline_usd < 0
   OR opportunity_win_rate_pct < 0
   OR opportunity_win_rate_pct > 100
   OR lead_conversion_rate_pct < 0
   OR lead_conversion_rate_pct > 100
   OR leads_created_30d < 0
   OR lead_to_opp_rate_pct_30d < 0
   OR sessions_30d < 0
   OR avg_success_rate_pct_30d < 0
   OR avg_success_rate_pct_30d > 100
   OR avg_p95_duration_seconds_30d < 0
   OR avg_errors_per_1k_sessions_30d < 0
