-- Fail rows where metric spine values violate expected constraints.
SELECT
    metric_date,
    organization_id,
    runs,
    successful_runs,
    success_rate_pct,
    dau_org,
    total_events,
    total_errors,
    total_run_minutes,
    mrr_usd
FROM {{ ref('metric_spine') }}
WHERE runs < 0
   OR successful_runs < 0
   OR successful_runs > runs
   OR success_rate_pct < 0
   OR success_rate_pct > 100
   OR dau_org NOT IN (0, 1)
   OR total_events < 0
   OR total_errors < 0
   OR total_run_minutes < 0
   OR mrr_usd < 0
