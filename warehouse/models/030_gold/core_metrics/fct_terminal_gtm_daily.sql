{{ config(alias='gtm_daily', schema='term') }}

-- =============================================================================
-- FACT VIEW: GTM Terminal Daily
-- =============================================================================
-- Grain: 1 row per metric_date
-- Purpose: Standardized GTM daily trend inputs for pipeline + funnel widgets
-- =============================================================================

WITH funnel AS (
    SELECT
        metric_date,
        leads_created,
        qualified_leads_created,
        leads_converted,
        opportunities_created,
        opportunities_closed_won,
        opportunities_amount_created_usd,
        closed_won_amount_usd
    FROM {{ ref('gtm_funnel_daily') }}
),

pipeline AS (
    SELECT
        as_of_date AS metric_date,
        open_pipeline_usd,
        won_revenue_usd,
        lead_conversion_rate_pct,
        opportunity_win_rate_pct,
        leads_total,
        opportunities_total
    FROM {{ ref('gtm_pipeline_snapshot') }}
),

daily_growth AS (
    SELECT
        metric_date,
        new_organizations,
        new_users,
        total_sessions
    FROM {{ ref('growth_daily') }}
),

calendar AS (
    SELECT metric_date FROM funnel
    UNION
    SELECT metric_date FROM pipeline
    UNION
    SELECT metric_date FROM daily_growth
)

SELECT
    c.metric_date,
    f.leads_created,
    f.qualified_leads_created,
    f.leads_converted,
    f.opportunities_created,
    f.opportunities_closed_won,
    f.opportunities_amount_created_usd,
    f.closed_won_amount_usd,
    p.open_pipeline_usd,
    p.won_revenue_usd,
    p.lead_conversion_rate_pct,
    p.opportunity_win_rate_pct,
    p.leads_total,
    p.opportunities_total,
    g.new_organizations,
    g.new_users,
    g.total_sessions,
    CURRENT_TIMESTAMP AS _loaded_at
FROM calendar c
LEFT JOIN funnel f ON c.metric_date = f.metric_date
LEFT JOIN pipeline p ON c.metric_date = p.metric_date
LEFT JOIN daily_growth g ON c.metric_date = g.metric_date
ORDER BY c.metric_date DESC
