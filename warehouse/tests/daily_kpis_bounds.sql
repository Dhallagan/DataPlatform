-- Fail rows where daily KPI values violate expected ranges/relationships.
SELECT
    date,
    total_sessions,
    successful_sessions,
    failed_sessions,
    success_rate_pct,
    daily_active_organizations,
    new_organizations,
    new_users
FROM {{ ref('daily_kpis') }}
WHERE total_sessions < 0
   OR successful_sessions < 0
   OR failed_sessions < 0
   OR successful_sessions > total_sessions
   OR failed_sessions > total_sessions
   OR (successful_sessions + failed_sessions) <> total_sessions
   OR success_rate_pct < 0
   OR success_rate_pct > 100
   OR daily_active_organizations < 0
   OR new_organizations < 0
   OR new_users < 0
