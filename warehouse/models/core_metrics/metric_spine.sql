-- =============================================================================
-- METRIC SPINE: Daily Organization Metrics
-- =============================================================================
-- Grain: 1 row per organization per day
-- Purpose: Single canonical table for core decision metrics
-- =============================================================================

{{ config(materialized='table') }}

WITH runs_daily AS (
    SELECT
        organization_id,
        run_date AS metric_date,
        COUNT(*) AS runs,
        COUNT(CASE WHEN is_successful THEN 1 END) AS successful_runs,
        SUM(event_count) AS total_events,
        SUM(error_count) AS total_errors,
        SUM(duration_seconds) AS total_run_seconds
    FROM {{ ref('fct_runs') }}
    GROUP BY 1, 2
),

subscription_daily AS (
    SELECT
        s.organization_id,
        gs.day::DATE AS metric_date,
        p.monthly_price_usd AS mrr_usd
    FROM {{ ref('fct_subscriptions') }} s
    LEFT JOIN {{ ref('stg_plans') }} p ON s.plan_id = p.plan_id
    CROSS JOIN LATERAL generate_series(
        DATE(s.current_period_start),
        DATE(COALESCE(s.current_period_end, CURRENT_TIMESTAMP)),
        INTERVAL 1 DAY
    ) AS gs(day)
    WHERE s.subscription_status = 'active'
      AND p.monthly_price_usd > 0
),

org_dates AS (
    SELECT organization_id, metric_date FROM runs_daily
    UNION
    SELECT organization_id, metric_date FROM subscription_daily
),

final AS (
    SELECT
        od.metric_date,
        od.organization_id,
        COALESCE(r.runs, 0) AS runs,
        COALESCE(r.successful_runs, 0) AS successful_runs,
        CASE
            WHEN COALESCE(r.runs, 0) = 0 THEN 0
            ELSE ROUND(
                COALESCE(r.successful_runs, 0)::DECIMAL / COALESCE(r.runs, 0) * 100,
                2
            )
        END AS success_rate_pct,
        CASE WHEN COALESCE(r.runs, 0) > 0 THEN 1 ELSE 0 END AS dau_org,
        COALESCE(r.total_events, 0) AS total_events,
        COALESCE(r.total_errors, 0) AS total_errors,
        ROUND(COALESCE(r.total_run_seconds, 0) / 60.0, 2) AS total_run_minutes,
        COALESCE(sd.mrr_usd, 0) AS mrr_usd,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM org_dates od
    LEFT JOIN runs_daily r
        ON od.organization_id = r.organization_id
       AND od.metric_date = r.metric_date
    LEFT JOIN subscription_daily sd
        ON od.organization_id = sd.organization_id
       AND od.metric_date = sd.metric_date
)

SELECT * FROM final
