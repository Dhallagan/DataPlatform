-- Fail rows where engineering rates and latency metrics are invalid.
SELECT
    metric_date,
    success_rate_pct,
    failure_rate_pct,
    timeout_rate_pct,
    p95_duration_seconds,
    p99_duration_seconds
FROM {{ ref('engineering_daily') }}
WHERE success_rate_pct < 0
   OR success_rate_pct > 100
   OR failure_rate_pct < 0
   OR failure_rate_pct > 100
   OR timeout_rate_pct < 0
   OR timeout_rate_pct > 100
   OR p95_duration_seconds < 0
   OR p99_duration_seconds < 0
   OR p99_duration_seconds < p95_duration_seconds
