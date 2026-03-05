{{ config(alias='kpi_product') }}

-- =============================================================================
-- METRIC VIEW: Product KPIs (30d)
-- =============================================================================

WITH recent AS (
    SELECT *
    FROM {{ ref('product_daily') }}
    WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
)

SELECT
    CURRENT_DATE AS as_of_date,
    SUM(total_sessions) AS sessions_30d,
    ROUND(AVG(success_rate_pct), 2) AS avg_success_rate_pct_30d,
    ROUND(AVG(avg_duration_seconds), 2) AS avg_duration_seconds_30d,
    ROUND(AVG(avg_pages_visited), 2) AS avg_pages_per_session_30d,
    ROUND(AVG(proxy_adoption_pct), 2) AS avg_proxy_adoption_pct_30d,
    ROUND(AVG(stealth_adoption_pct), 2) AS avg_stealth_adoption_pct_30d,
    MAX(unique_domains_visited) AS peak_unique_domains_visited_30d,
    CURRENT_TIMESTAMP AS _calculated_at
FROM recent
