-- =============================================================================
-- METRIC VIEW: Engineering KPIs (30d)
-- =============================================================================

WITH recent AS (
    SELECT *
    FROM {{ ref('fct_engineering_daily') }}
    WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
)

SELECT
    CURRENT_DATE AS as_of_date,
    SUM(total_sessions) AS sessions_30d,
    ROUND(AVG(success_rate_pct), 2) AS avg_success_rate_pct_30d,
    ROUND(AVG(failure_rate_pct), 2) AS avg_failure_rate_pct_30d,
    ROUND(AVG(timeout_rate_pct), 2) AS avg_timeout_rate_pct_30d,
    ROUND(AVG(errors_per_1k_sessions), 2) AS avg_errors_per_1k_sessions_30d,
    ROUND(AVG(p95_duration_seconds), 2) AS avg_p95_duration_seconds_30d,
    ROUND(AVG(p99_duration_seconds), 2) AS avg_p99_duration_seconds_30d,
    CURRENT_TIMESTAMP AS _calculated_at
FROM recent
