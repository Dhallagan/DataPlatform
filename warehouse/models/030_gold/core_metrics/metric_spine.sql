-- =============================================================================
-- METRIC SPINE: Daily Organization Metrics
-- =============================================================================
-- Grain: 1 row per organization per day
-- Purpose: Single canonical table for core decision metrics
-- =============================================================================

{{ config(materialized='table') }}

WITH scaffold AS (
    SELECT
        o.organization_id,
        d.date_day AS metric_date
    FROM {{ ref('organizations') }} o
    CROSS JOIN {{ ref('dim_time') }} d
    WHERE d.date_day >= DATE(o.organization_created_at)
      AND d.date_day <= CURRENT_DATE
),

sessions_daily AS (
    SELECT
        organization_id,
        session_date AS metric_date,
        COUNT(*) AS session_count,
        COUNT(CASE WHEN is_successful THEN 1 END) AS successful_session_count,
        SUM(event_count) AS event_count,
        SUM(error_count) AS error_count,
        SUM(duration_seconds) AS total_duration_seconds
    FROM {{ ref('sessions') }}
    GROUP BY 1, 2
),

new_entities_daily AS (
    SELECT
        organization_id,
        DATE(organization_created_at) AS metric_date,
        1 AS new_organization_count
    FROM {{ ref('organizations') }}
),

new_users_daily AS (
    SELECT
        primary_organization_id AS organization_id,
        DATE(user_created_at) AS metric_date,
        COUNT(*) AS new_user_count
    FROM {{ ref('users') }}
    WHERE primary_organization_id IS NOT NULL
    GROUP BY 1, 2
),

subscription_daily AS (
    SELECT
        s.organization_id,
        gs.day::DATE AS metric_date,
        p.monthly_price_usd AS subscription_mrr_usd
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

final AS (
    SELECT
        sc.metric_date,
        sc.organization_id,
        COALESCE(sd.session_count, 0) AS session_count,
        COALESCE(sd.successful_session_count, 0) AS successful_session_count,
        CASE
            WHEN COALESCE(sd.session_count, 0) = 0 THEN 0
            ELSE ROUND(
                COALESCE(sd.successful_session_count, 0)::DECIMAL / COALESCE(sd.session_count, 0) * 100,
                2
            )
        END AS session_success_rate_pct,
        CASE WHEN COALESCE(sd.session_count, 0) > 0 THEN 1 ELSE 0 END AS is_active_org,
        COALESCE(sd.event_count, 0) AS event_count,
        COALESCE(sd.error_count, 0) AS error_count,
        ROUND(COALESCE(sd.total_duration_seconds, 0) / 60.0, 2) AS session_duration_minutes,
        COALESCE(sub.subscription_mrr_usd, 0) AS subscription_mrr_usd,
        COALESCE(ne.new_organization_count, 0) AS new_organization_count,
        COALESCE(nu.new_user_count, 0) AS new_user_count,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM scaffold sc
    LEFT JOIN sessions_daily sd
        ON sc.organization_id = sd.organization_id
       AND sc.metric_date = sd.metric_date
    LEFT JOIN subscription_daily sub
        ON sc.organization_id = sub.organization_id
       AND sc.metric_date = sub.metric_date
    LEFT JOIN new_entities_daily ne
        ON sc.organization_id = ne.organization_id
       AND sc.metric_date = ne.metric_date
    LEFT JOIN new_users_daily nu
        ON sc.organization_id = nu.organization_id
       AND sc.metric_date = nu.metric_date
)

SELECT * FROM final
