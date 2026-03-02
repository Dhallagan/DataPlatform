-- Fail rows where percentage/rate metrics fall outside expected bounds.
SELECT
    'fct_daily_sessions.success_rate_pct' AS check_name,
    CAST(session_date AS VARCHAR) AS grain_key,
    success_rate_pct AS metric_value
FROM {{ ref('daily_sessions') }}
WHERE success_rate_pct < 0
   OR success_rate_pct > 100

UNION ALL

SELECT
    'fct_growth_daily.activation_rate_7d_pct' AS check_name,
    CAST(metric_date AS VARCHAR) AS grain_key,
    activation_rate_7d_pct AS metric_value
FROM {{ ref('growth_daily') }}
WHERE activation_rate_7d_pct IS NOT NULL
  AND (activation_rate_7d_pct < 0 OR activation_rate_7d_pct > 100)
