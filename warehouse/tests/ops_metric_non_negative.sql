-- Fail rows where ops utilization metrics go negative.
SELECT
    metric_date,
    total_sessions,
    active_organizations,
    total_gb_transferred,
    total_session_hours
FROM {{ ref('ops_daily') }}
WHERE total_sessions < 0
   OR active_organizations < 0
   OR total_gb_transferred < 0
   OR total_session_hours < 0
