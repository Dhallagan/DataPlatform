{{ config(alias='vw_customer_usage_billing_export') }}

-- =============================================================================
-- EXPORT VIEW: Customer Usage Billing Export
-- =============================================================================
-- Grain: 1 row per organization_id x billing period
-- Purpose: Export-safe billing view that preserves overages across mid-period
--          plan changes by using the session ledger + subscription history.
-- =============================================================================

WITH billing_periods AS (
    SELECT
        organization_id,
        period_start,
        period_end,
        MAX(sessions_count) AS recorded_sessions_count,
        MAX(session_minutes) AS recorded_session_minutes,
        MAX(bytes_downloaded) AS recorded_bytes_downloaded,
        MAX(bytes_uploaded) AS recorded_bytes_uploaded,
        MAX(proxy_requests) AS recorded_proxy_requests
    FROM {{ ref('stg_usage_records') }}
    GROUP BY 1, 2, 3
),

organization_context AS (
    SELECT
        o.organization_id,
        o.organization_name,
        o.billing_email,
        s.subscription_id AS current_subscription_id,
        s.plan_id AS current_plan_id,
        p.plan_name AS current_plan_name,
        p.sessions_limit_monthly
    FROM {{ ref('stg_organizations') }} o
    LEFT JOIN (
        SELECT
            organization_id,
            subscription_id,
            plan_id
        FROM (
            SELECT
                organization_id,
                subscription_id,
                plan_id,
                ROW_NUMBER() OVER (
                    PARTITION BY organization_id
                    ORDER BY COALESCE(current_period_start, created_at) DESC, created_at DESC
                ) AS rn
            FROM {{ ref('stg_subscriptions') }}
        ) ranked
        WHERE rn = 1
    ) s
      ON o.organization_id = s.organization_id
    LEFT JOIN {{ ref('stg_plans') }} p
      ON s.plan_id = p.plan_id
),

plan_catalog AS (
    SELECT
        plan_id,
        plan_name,
        sessions_limit_monthly
    FROM {{ ref('stg_plans') }}
),

subscription_base AS (
    SELECT
        s.organization_id,
        s.subscription_id,
        p.plan_name,
        p.sessions_limit_monthly,
        DATE(COALESCE(s.current_period_start, s.created_at)) AS effective_start_date,
        DATE(COALESCE(s.current_period_end, '2999-12-31'::TIMESTAMP)) AS raw_end_date
    FROM {{ ref('stg_subscriptions') }} s
    LEFT JOIN plan_catalog p
      ON s.plan_id = p.plan_id
),

subscription_history AS (
    SELECT
        organization_id,
        subscription_id,
        plan_name,
        sessions_limit_monthly,
        effective_start_date,
        COALESCE(
            LEAST(
                raw_end_date,
                LEAD(effective_start_date) OVER (
                    PARTITION BY organization_id
                    ORDER BY effective_start_date, subscription_id
                ) - INTERVAL 1 DAY
            )::DATE,
            raw_end_date
        ) AS effective_end_date
    FROM subscription_base
),

entitlement_slices AS (
    SELECT
        bp.organization_id,
        bp.period_start,
        bp.period_end,
        sh.subscription_id,
        sh.plan_name,
        sh.sessions_limit_monthly,
        GREATEST(bp.period_start, sh.effective_start_date) AS overlap_start,
        LEAST(bp.period_end, sh.effective_end_date) AS overlap_end,
        DATE_DIFF('day', bp.period_start, bp.period_end) + 1 AS period_days
    FROM billing_periods bp
    LEFT JOIN subscription_history sh
      ON bp.organization_id = sh.organization_id
     AND sh.effective_start_date <= bp.period_end
     AND sh.effective_end_date >= bp.period_start
),

period_entitlements AS (
    SELECT
        organization_id,
        period_start,
        period_end,
        SUM(
            CASE
                WHEN overlap_end < overlap_start THEN 0
                WHEN sessions_limit_monthly IS NULL THEN NULL
                ELSE sessions_limit_monthly
                     * (DATE_DIFF('day', overlap_start, overlap_end) + 1)::DOUBLE
                     / NULLIF(period_days, 0)
            END
        ) AS corrected_entitled_sessions,
        MAX(CASE WHEN sessions_limit_monthly IS NULL THEN 1 ELSE 0 END) AS has_unlimited_slice
    FROM entitlement_slices
    GROUP BY 1, 2, 3
),

session_ledger_usage AS (
    SELECT
        bp.organization_id,
        bp.period_start,
        bp.period_end,
        COUNT(s.session_id) AS ledger_sessions_count
    FROM billing_periods bp
    LEFT JOIN {{ ref('stg_sessions') }} s
      ON s.organization_id = bp.organization_id
     AND DATE(s.created_at) BETWEEN bp.period_start AND bp.period_end
    GROUP BY 1, 2, 3
),

naive_snapshot_usage AS (
    SELECT
        bp.organization_id,
        bp.period_start,
        bp.period_end,
        oc.sessions_limit_monthly AS current_plan_sessions_limit,
        DATE(COALESCE(sh.effective_start_date, bp.period_start)) AS naive_period_start,
        COUNT(s.session_id) AS naive_snapshot_sessions_count
    FROM billing_periods bp
    LEFT JOIN organization_context oc
      ON bp.organization_id = oc.organization_id
    LEFT JOIN subscription_history sh
      ON oc.current_subscription_id = sh.subscription_id
    LEFT JOIN {{ ref('stg_sessions') }} s
      ON s.organization_id = bp.organization_id
     AND DATE(s.created_at) BETWEEN GREATEST(bp.period_start, DATE(COALESCE(sh.effective_start_date, bp.period_start))) AND bp.period_end
    GROUP BY 1, 2, 3, 4, 5
),

final AS (
    SELECT
        bp.organization_id,
        oc.organization_name,
        oc.billing_email,
        oc.current_plan_id,
        oc.current_plan_name,
        bp.period_start AS billing_period_start,
        bp.period_end AS billing_period_end,
        COALESCE(su.ledger_sessions_count, 0) AS ledger_sessions_count,
        bp.recorded_sessions_count,
        bp.recorded_session_minutes,
        bp.recorded_bytes_downloaded,
        bp.recorded_bytes_uploaded,
        bp.recorded_proxy_requests,
        CASE
            WHEN pe.has_unlimited_slice = 1 THEN NULL
            ELSE pe.corrected_entitled_sessions
        END AS corrected_entitled_sessions,
        CASE
            WHEN pe.has_unlimited_slice = 1 THEN 0
            ELSE GREATEST(COALESCE(su.ledger_sessions_count, 0) - COALESCE(pe.corrected_entitled_sessions, 0), 0)
        END AS corrected_overage_sessions,
        ns.current_plan_sessions_limit,
        COALESCE(ns.naive_snapshot_sessions_count, 0) AS naive_snapshot_sessions_count,
        CASE
            WHEN ns.current_plan_sessions_limit IS NULL THEN 0
            ELSE GREATEST(COALESCE(ns.naive_snapshot_sessions_count, 0) - ns.current_plan_sessions_limit, 0)
        END AS naive_overage_sessions,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM billing_periods bp
    LEFT JOIN organization_context oc
      ON bp.organization_id = oc.organization_id
    LEFT JOIN period_entitlements pe
      ON bp.organization_id = pe.organization_id
     AND bp.period_start = pe.period_start
     AND bp.period_end = pe.period_end
    LEFT JOIN session_ledger_usage su
      ON bp.organization_id = su.organization_id
     AND bp.period_start = su.period_start
     AND bp.period_end = su.period_end
    LEFT JOIN naive_snapshot_usage ns
      ON bp.organization_id = ns.organization_id
     AND bp.period_start = ns.period_start
     AND bp.period_end = ns.period_end
)

SELECT
    organization_id,
    organization_name,
    billing_email,
    current_plan_id,
    current_plan_name,
    billing_period_start,
    billing_period_end,
    ledger_sessions_count,
    recorded_sessions_count,
    recorded_session_minutes,
    recorded_bytes_downloaded,
    recorded_bytes_uploaded,
    recorded_proxy_requests,
    corrected_entitled_sessions,
    corrected_overage_sessions,
    current_plan_sessions_limit,
    naive_snapshot_sessions_count,
    naive_overage_sessions,
    (corrected_overage_sessions - naive_overage_sessions) AS overage_leakage_delta,
    _loaded_at
FROM final
