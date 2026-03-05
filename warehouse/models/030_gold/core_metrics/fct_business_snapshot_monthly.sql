-- =============================================================================
-- FACT: Business Snapshot Monthly
-- =============================================================================
-- Grain: 1 row per organization per month
-- Purpose: Canonical monthly org snapshot across GTM, finance, ops, and product
-- =============================================================================

{{ config(materialized='table') }}

WITH months AS (
    SELECT DISTINCT month_start
    FROM {{ ref('dim_time') }}
    WHERE month_start <= DATE_TRUNC('month', CURRENT_DATE)
),

organizations AS (
    SELECT
        organization_id,
        organization_name,
        organization_status,
        current_plan_name
    FROM {{ ref('organizations') }}
),

org_month_spine AS (
    SELECT
        o.organization_id,
        o.organization_name,
        o.organization_status,
        o.current_plan_name,
        m.month_start
    FROM organizations o
    CROSS JOIN months m
),

runs_monthly AS (
    SELECT
        organization_id,
        DATE_TRUNC('month', session_date)::DATE AS month_start,
        COUNT(*) AS total_runs,
        COUNT(CASE WHEN is_successful THEN 1 END) AS successful_runs,
        COUNT(CASE WHEN NOT is_successful THEN 1 END) AS failed_runs,
        SUM(COALESCE(duration_seconds, 0)) AS total_duration_seconds,
        SUM(COALESCE(error_count, 0)) AS total_errors,
        SUM(COALESCE(event_count, 0)) AS total_events,
        COUNT(DISTINCT session_date) AS active_days_in_month,
        SUM(CASE WHEN used_proxy THEN 1 ELSE 0 END) AS sessions_with_proxy,
        SUM(CASE WHEN is_stealth_mode THEN 1 ELSE 0 END) AS sessions_with_stealth,
        AVG(NULLIF(pages_visited, 0)) AS avg_pages_per_session
    FROM {{ ref('sessions') }}
    GROUP BY 1, 2
),

mrr_monthly AS (
    SELECT
        organization_id,
        DATE_TRUNC('month', metric_date)::DATE AS month_start,
        MAX(mrr_usd) AS mrr_usd
    FROM {{ ref('metric_spine') }}
    GROUP BY 1, 2
),

revenue_monthly AS (
    SELECT
        organization_id,
        revenue_month AS month_start,
        realized_revenue_usd,
        gross_revenue_usd
    FROM {{ ref('monthly_revenue') }}
),

finance_monthly AS (
    SELECT
        organization_id,
        budget_month AS month_start,
        card_spend_usd,
        reimbursement_spend_usd,
        bill_payment_spend_usd,
        actual_spend_usd AS total_spend_usd,
        budget_allocated_usd,
        budget_variance_usd,
        ap_open_usd
    FROM {{ ref('finance_budget_vs_actual_monthly') }}
),

gtm_leads_monthly AS (
    SELECT
        a.organization_id,
        DATE_TRUNC('month', l.created_at)::DATE AS month_start,
        COUNT(*) AS new_leads,
        COUNT(CASE WHEN l.lead_status = 'qualified' THEN 1 END) AS qualified_leads
    FROM {{ ref('stg_gtm_leads') }} l
    INNER JOIN {{ ref('stg_gtm_accounts') }} a ON l.account_id = a.account_id
    GROUP BY 1, 2
),

gtm_opp_created_monthly AS (
    SELECT
        a.organization_id,
        DATE_TRUNC('month', o.created_at)::DATE AS month_start,
        COUNT(*) AS new_opportunities,
        SUM(
            CASE
                WHEN o.stage NOT IN ('closed_won', 'closed_lost') THEN COALESCE(o.amount_usd, 0)
                ELSE 0
            END
        ) AS pipeline_open_usd
    FROM {{ ref('stg_gtm_opportunities') }} o
    INNER JOIN {{ ref('stg_gtm_accounts') }} a ON o.account_id = a.account_id
    GROUP BY 1, 2
),

gtm_opp_won_monthly AS (
    SELECT
        a.organization_id,
        DATE_TRUNC('month', o.closed_at)::DATE AS month_start,
        COUNT(*) AS won_opportunities,
        SUM(COALESCE(o.amount_usd, 0)) AS won_revenue_usd
    FROM {{ ref('stg_gtm_opportunities') }} o
    INNER JOIN {{ ref('stg_gtm_accounts') }} a ON o.account_id = a.account_id
    WHERE o.stage = 'closed_won'
      AND o.closed_at IS NOT NULL
    GROUP BY 1, 2
),

combined AS (
    SELECT
        s.organization_id,
        s.organization_name,
        s.organization_status,
        s.current_plan_name,
        s.month_start,
        (s.month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE AS month_end,

        COALESCE(gl.new_leads, 0) AS new_leads,
        COALESCE(gl.qualified_leads, 0) AS qualified_leads,
        COALESCE(gc.new_opportunities, 0) AS new_opportunities,
        COALESCE(gw.won_opportunities, 0) AS won_opportunities,
        COALESCE(gc.pipeline_open_usd, 0) AS pipeline_open_usd,
        COALESCE(gw.won_revenue_usd, 0) AS won_revenue_usd,

        COALESCE(mm.mrr_usd, 0) AS mrr_usd,
        COALESCE(rm.realized_revenue_usd, 0) AS recognized_revenue_usd,
        COALESCE(rm.gross_revenue_usd, 0) AS gross_revenue_usd,
        COALESCE(fm.card_spend_usd, 0) AS card_spend_usd,
        COALESCE(fm.reimbursement_spend_usd, 0) AS reimbursement_spend_usd,
        COALESCE(fm.bill_payment_spend_usd, 0) AS bill_payment_spend_usd,
        COALESCE(fm.total_spend_usd, 0) AS total_spend_usd,
        COALESCE(fm.budget_allocated_usd, 0) AS budget_allocated_usd,
        COALESCE(fm.budget_variance_usd, 0) AS budget_variance_usd,
        COALESCE(fm.ap_open_usd, 0) AS ap_open_usd,

        COALESCE(rn.total_runs, 0) AS total_runs,
        COALESCE(rn.successful_runs, 0) AS successful_runs,
        COALESCE(rn.failed_runs, 0) AS failed_runs,
        COALESCE(rn.total_duration_seconds, 0) AS total_duration_seconds,
        COALESCE(rn.total_errors, 0) AS total_errors,
        COALESCE(rn.total_events, 0) AS total_events,
        COALESCE(rn.active_days_in_month, 0) AS active_days_in_month,
        COALESCE(rn.sessions_with_proxy, 0) AS sessions_with_proxy,
        COALESCE(rn.sessions_with_stealth, 0) AS sessions_with_stealth,
        COALESCE(rn.avg_pages_per_session, 0) AS avg_pages_per_session
    FROM org_month_spine s
    LEFT JOIN runs_monthly rn
      ON s.organization_id = rn.organization_id
     AND s.month_start = rn.month_start
    LEFT JOIN mrr_monthly mm
      ON s.organization_id = mm.organization_id
     AND s.month_start = mm.month_start
    LEFT JOIN revenue_monthly rm
      ON s.organization_id = rm.organization_id
     AND s.month_start = rm.month_start
    LEFT JOIN finance_monthly fm
      ON s.organization_id = fm.organization_id
     AND s.month_start = fm.month_start
    LEFT JOIN gtm_leads_monthly gl
      ON s.organization_id = gl.organization_id
     AND s.month_start = gl.month_start
    LEFT JOIN gtm_opp_created_monthly gc
      ON s.organization_id = gc.organization_id
     AND s.month_start = gc.month_start
    LEFT JOIN gtm_opp_won_monthly gw
      ON s.organization_id = gw.organization_id
     AND s.month_start = gw.month_start
),

final AS (
    SELECT
        *,
        ROUND(qualified_leads::DOUBLE / NULLIF(new_leads, 0) * 100, 2) AS lead_to_opp_rate,
        ROUND(won_opportunities::DOUBLE / NULLIF(new_opportunities, 0) * 100, 2) AS opp_win_rate,
        ROUND(successful_runs::DOUBLE / NULLIF(total_runs, 0) * 100, 2) AS success_rate_pct,
        ROUND(total_duration_seconds::DOUBLE / NULLIF(total_runs, 0), 2) AS avg_session_duration_seconds,
        ROUND(recognized_revenue_usd / NULLIF(total_runs, 0), 2) AS revenue_per_run,
        ROUND(recognized_revenue_usd / NULLIF(total_runs, 0), 2) AS revenue_per_session,
        ROUND(recognized_revenue_usd - total_spend_usd, 2) AS gross_margin_proxy_usd,
        ROUND((recognized_revenue_usd - total_spend_usd) / NULLIF(recognized_revenue_usd, 0) * 100, 2) AS gross_margin_proxy_pct,
        ROUND((sessions_with_proxy::DOUBLE / NULLIF(total_runs, 0)) * 100, 2) AS proxy_session_rate_pct,
        ROUND((sessions_with_stealth::DOUBLE / NULLIF(total_runs, 0)) * 100, 2) AS stealth_session_rate_pct,
        ROUND((sessions_with_proxy::DOUBLE / NULLIF(total_runs, 0)) * 100, 2) AS feature_adoption_rate,
        ROUND(
            (recognized_revenue_usd - LAG(recognized_revenue_usd) OVER (PARTITION BY organization_id ORDER BY month_start))
            / NULLIF(LAG(recognized_revenue_usd) OVER (PARTITION BY organization_id ORDER BY month_start), 0) * 100,
            2
        ) AS mom_revenue_growth_pct,
        ROUND(
            (total_runs - LAG(total_runs) OVER (PARTITION BY organization_id ORDER BY month_start))
            / NULLIF(LAG(total_runs) OVER (PARTITION BY organization_id ORDER BY month_start), 0) * 100,
            2
        ) AS mom_runs_growth_pct,
        ROUND(
            (total_spend_usd - LAG(total_spend_usd) OVER (PARTITION BY organization_id ORDER BY month_start))
            / NULLIF(LAG(total_spend_usd) OVER (PARTITION BY organization_id ORDER BY month_start), 0) * 100,
            2
        ) AS mom_spend_growth_pct,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM combined
)

SELECT * FROM final
