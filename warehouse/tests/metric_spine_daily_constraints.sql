-- Fail rows where metric spine values violate expected constraints.
SELECT
    metric_date,
    organization_id,
    session_count,
    successful_session_count,
    session_success_rate_pct,
    is_active_org,
    event_count,
    error_count,
    session_duration_minutes,
    subscription_mrr_usd,
    new_organization_count,
    new_user_count
FROM {{ ref('metric_spine') }}
WHERE session_count < 0
   OR successful_session_count < 0
   OR successful_session_count > session_count
   OR session_success_rate_pct < 0
   OR session_success_rate_pct > 100
   OR is_active_org NOT IN (0, 1)
   OR event_count < 0
   OR error_count < 0
   OR session_duration_minutes < 0
   OR subscription_mrr_usd < 0
   OR new_organization_count < 0
   OR new_user_count < 0
