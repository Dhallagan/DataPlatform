-- =============================================================================
-- METRIC VIEW: Ops KPIs (30d)
-- =============================================================================

WITH recent AS (
    SELECT *
    FROM {{ ref('ops_daily') }}
    WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
)

SELECT
    CURRENT_DATE AS as_of_date,
    SUM(total_sessions) AS sessions_30d,
    SUM(total_gb_transferred) AS total_gb_transferred_30d,
    SUM(total_session_hours) AS total_session_hours_30d,
    ROUND(AVG(avg_duration_seconds), 2) AS avg_duration_seconds_30d,
    ROUND(AVG(proxy_session_pct), 2) AS avg_proxy_session_pct_30d,
    ROUND(AVG(stealth_session_pct), 2) AS avg_stealth_session_pct_30d,
    SUM(api_keys_created) AS api_keys_created_30d,
    SUM(active_api_keys_created) AS active_api_keys_created_30d,
    CURRENT_TIMESTAMP AS _calculated_at
FROM recent
