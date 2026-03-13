{{ config(alias='agg_customer_unit_economics_monthly') }}

-- =============================================================================
-- FACT TABLE: Customer Unit Economics Monthly
-- =============================================================================
-- Grain: 1 row per organization per month
-- Purpose: Expected cost, revenue, margin, and utilization rollup per customer
-- =============================================================================

WITH sessions_base AS (
    SELECT
        session_id,
        organization_id,
        COALESCE(started_at, created_at) AS session_ts,
        DATE_TRUNC('month', COALESCE(started_at, created_at))::DATE AS metric_month,
        GREATEST(COALESCE(duration_seconds, 0), 0) AS duration_seconds
    FROM {{ ref('sessions') }}
    WHERE COALESCE(started_at, created_at) IS NOT NULL
      AND duration_seconds IS NOT NULL
      AND duration_seconds > 0
),

subscriptions_base AS (
    SELECT
        s.organization_id,
        s.subscription_id,
        s.plan_id,
        p.plan_name,
        p.sessions_limit_monthly,
        p.max_session_duration_mins,
        COALESCE(s.current_period_start, s.created_at) AS effective_start_ts,
        COALESCE(s.current_period_end, '2999-12-31'::TIMESTAMP) AS raw_end_ts
    FROM {{ ref('stg_subscriptions') }} s
    LEFT JOIN {{ ref('stg_plans') }} p
      ON s.plan_id = p.plan_id
),

subscriptions_history AS (
    SELECT
        organization_id,
        subscription_id,
        plan_id,
        plan_name,
        sessions_limit_monthly,
        max_session_duration_mins,
        effective_start_ts,
        COALESCE(
            LEAST(
                raw_end_ts,
                LEAD(effective_start_ts) OVER (
                    PARTITION BY organization_id
                    ORDER BY effective_start_ts, subscription_id
                ) - INTERVAL 1 SECOND
            ),
            raw_end_ts
        ) AS effective_end_ts
    FROM subscriptions_base
),

session_subscription_match AS (
    SELECT
        sb.session_id,
        sb.organization_id,
        sb.session_ts,
        sb.metric_month,
        sb.duration_seconds,
        sh.subscription_id,
        sh.plan_id,
        sh.plan_name,
        ROW_NUMBER() OVER (
            PARTITION BY sb.session_id
            ORDER BY sh.effective_start_ts DESC, sh.subscription_id DESC
        ) AS rn
    FROM sessions_base sb
    LEFT JOIN subscriptions_history sh
      ON sb.organization_id = sh.organization_id
     AND sb.session_ts >= sh.effective_start_ts
     AND sb.session_ts <= sh.effective_end_ts
),

session_subscription AS (
    SELECT
        session_id,
        organization_id,
        session_ts,
        metric_month,
        duration_seconds,
        subscription_id,
        plan_id,
        plan_name
    FROM session_subscription_match
    WHERE rn = 1
),

session_economics_match AS (
    SELECT
        ss.session_id,
        ss.organization_id,
        ss.metric_month,
        ss.duration_seconds,
        ss.subscription_id,
        ss.plan_id,
        ss.plan_name,
        pe.expected_cost_per_hour_usd,
        ROW_NUMBER() OVER (
            PARTITION BY ss.session_id
            ORDER BY pe.effective_start DESC
        ) AS rn
    FROM session_subscription ss
    LEFT JOIN {{ ref('stg_plan_economics') }} pe
      ON ss.plan_id = pe.plan_id
     AND ss.session_ts >= pe.effective_start
     AND ss.session_ts < COALESCE(pe.effective_end, '2999-12-31'::TIMESTAMP)
),

session_enriched AS (
    SELECT
        session_id,
        organization_id,
        metric_month,
        subscription_id,
        plan_id,
        plan_name,
        duration_seconds,
        duration_seconds / 3600.0 AS session_hours,
        expected_cost_per_hour_usd,
        (duration_seconds / 3600.0) * COALESCE(expected_cost_per_hour_usd, 0) AS session_expected_cost_usd
    FROM session_economics_match
    WHERE rn = 1
),

session_plan_ranked AS (
    SELECT
        organization_id,
        metric_month,
        plan_name,
        COUNT(*) AS plan_session_count,
        ROW_NUMBER() OVER (
            PARTITION BY organization_id, metric_month
            ORDER BY COUNT(*) DESC, plan_name
        ) AS rn
    FROM session_enriched
    GROUP BY 1, 2, 3
),

primary_plan_monthly AS (
    SELECT
        organization_id,
        metric_month,
        plan_name AS primary_plan_name
    FROM session_plan_ranked
    WHERE rn = 1
),

customer_session_monthly AS (
    SELECT
        organization_id,
        metric_month,
        COUNT(*) AS sessions_with_duration,
        SUM(session_hours) AS total_session_hours,
        SUM(session_expected_cost_usd) AS expected_cost_usd,
        COUNT(CASE WHEN expected_cost_per_hour_usd IS NULL THEN 1 END) AS sessions_missing_cost_assumption
    FROM session_enriched
    GROUP BY 1, 2
),

revenue_monthly AS (
    SELECT
        organization_id,
        revenue_month AS metric_month,
        MAX(organization_name) AS organization_name,
        SUM(realized_revenue_usd) AS realized_revenue_usd,
        SUM(pending_revenue_usd) AS pending_revenue_usd,
        SUM(gross_revenue_usd) AS gross_revenue_usd
    FROM {{ ref('monthly_revenue') }}
    GROUP BY 1, 2
),

month_spine AS (
    SELECT organization_id, metric_month FROM customer_session_monthly
    UNION
    SELECT organization_id, metric_month FROM revenue_monthly
),

month_bounds AS (
    SELECT
        organization_id,
        metric_month,
        metric_month AS month_start,
        (metric_month + INTERVAL 1 MONTH - INTERVAL 1 DAY)::DATE AS month_end,
        DATE_DIFF('day', metric_month, (metric_month + INTERVAL 1 MONTH - INTERVAL 1 DAY)::DATE) + 1 AS month_days
    FROM month_spine
),

subscription_entitlements AS (
    SELECT
        slice.organization_id,
        slice.metric_month,
        SUM(
            CASE
                WHEN slice.sessions_limit_monthly IS NULL THEN NULL
                WHEN slice.overlap_end < slice.overlap_start THEN 0
                ELSE slice.sessions_limit_monthly
                     * (DATE_DIFF('day', CAST(slice.overlap_start AS DATE), CAST(slice.overlap_end AS DATE)) + 1)::DOUBLE
                     / NULLIF(slice.month_days, 0)
            END
        ) AS entitled_sessions_monthly_prorated,
        SUM(
            CASE
                WHEN slice.sessions_limit_monthly IS NULL THEN NULL
                WHEN slice.max_session_duration_mins IS NULL THEN NULL
                WHEN slice.overlap_end < slice.overlap_start THEN 0
                ELSE (
                    slice.sessions_limit_monthly * (slice.max_session_duration_mins / 60.0)
                ) * (DATE_DIFF('day', CAST(slice.overlap_start AS DATE), CAST(slice.overlap_end AS DATE)) + 1)::DOUBLE
                  / NULLIF(slice.month_days, 0)
            END
        ) AS entitled_hours_monthly_prorated,
        MAX(CASE WHEN slice.sessions_limit_monthly IS NULL THEN 1 ELSE 0 END) AS has_unlimited_slice
    FROM (
        SELECT
            mb.organization_id,
            mb.metric_month,
            mb.month_days,
            sh.sessions_limit_monthly,
            sh.max_session_duration_mins,
            GREATEST(sh.effective_start_ts, mb.month_start::TIMESTAMP) AS overlap_start,
            LEAST(
                sh.effective_end_ts,
                (mb.month_end::TIMESTAMP + INTERVAL 1 DAY - INTERVAL 1 SECOND)
            ) AS overlap_end
        FROM month_bounds mb
        LEFT JOIN subscriptions_history sh
          ON mb.organization_id = sh.organization_id
         AND sh.effective_start_ts <= (mb.month_end::TIMESTAMP + INTERVAL 1 DAY - INTERVAL 1 SECOND)
         AND sh.effective_end_ts >= mb.month_start::TIMESTAMP
    ) slice
    GROUP BY 1, 2
),

final AS (
    SELECT
        ms.organization_id,
        COALESCE(rm.organization_name, o.organization_name) AS organization_name,
        ms.metric_month,
        ppm.primary_plan_name,
        COALESCE(csm.sessions_with_duration, 0) AS sessions_with_duration,
        COALESCE(csm.total_session_hours, 0) AS total_session_hours,
        COALESCE(csm.expected_cost_usd, 0) AS expected_cost_usd,
        COALESCE(csm.sessions_missing_cost_assumption, 0) AS sessions_missing_cost_assumption,
        rm.realized_revenue_usd,
        rm.pending_revenue_usd,
        rm.gross_revenue_usd,
        se.entitled_sessions_monthly_prorated,
        CASE
            WHEN se.has_unlimited_slice = 1 THEN NULL
            ELSE se.entitled_hours_monthly_prorated
        END AS entitled_hours_monthly_prorated,
        ROUND(
            COALESCE(csm.expected_cost_usd, 0) / NULLIF(COALESCE(csm.sessions_with_duration, 0), 0),
            4
        ) AS expected_cost_per_session_usd,
        ROUND(
            COALESCE(csm.expected_cost_usd, 0) / NULLIF(COALESCE(csm.total_session_hours, 0), 0),
            4
        ) AS blended_expected_cost_per_hour_usd,
        ROUND(
            COALESCE(rm.realized_revenue_usd, 0) - COALESCE(csm.expected_cost_usd, 0),
            2
        ) AS gross_margin_usd,
        ROUND(
            (COALESCE(rm.realized_revenue_usd, 0) - COALESCE(csm.expected_cost_usd, 0))
            / NULLIF(COALESCE(rm.realized_revenue_usd, 0), 0) * 100,
            2
        ) AS gross_margin_pct,
        ROUND(
            COALESCE(csm.total_session_hours, 0)
            / NULLIF(
                CASE WHEN se.has_unlimited_slice = 1 THEN NULL ELSE se.entitled_hours_monthly_prorated END,
                0
            ) * 100,
            2
        ) AS utilization_pct,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM month_spine ms
    LEFT JOIN customer_session_monthly csm
      ON ms.organization_id = csm.organization_id
     AND ms.metric_month = csm.metric_month
    LEFT JOIN primary_plan_monthly ppm
      ON ms.organization_id = ppm.organization_id
     AND ms.metric_month = ppm.metric_month
    LEFT JOIN revenue_monthly rm
      ON ms.organization_id = rm.organization_id
     AND ms.metric_month = rm.metric_month
    LEFT JOIN subscription_entitlements se
      ON ms.organization_id = se.organization_id
     AND ms.metric_month = se.metric_month
    LEFT JOIN {{ ref('stg_organizations') }} o
      ON ms.organization_id = o.organization_id
)

SELECT * FROM final
