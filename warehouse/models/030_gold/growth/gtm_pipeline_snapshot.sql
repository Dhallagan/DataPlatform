{{ config(alias='snap_pipeline_daily') }}

-- =============================================================================
-- METRIC VIEW: GTM Pipeline Snapshot
-- =============================================================================
-- Grain: 1 row (current snapshot)
-- Purpose: Open pipeline and conversion health for go-to-market teams
-- =============================================================================

WITH leads AS (
    SELECT * FROM {{ ref('stg_gtm_leads') }}
),

opportunities AS (
    SELECT * FROM {{ ref('stg_gtm_opportunities') }}
),

lead_stats AS (
    SELECT
        COUNT(*) AS leads_total,
        COUNT(CASE WHEN lead_status = 'new' THEN 1 END) AS leads_new,
        COUNT(CASE WHEN lead_status = 'working' THEN 1 END) AS leads_working,
        COUNT(CASE WHEN lead_status = 'nurturing' THEN 1 END) AS leads_nurturing,
        COUNT(CASE WHEN lead_status = 'qualified' THEN 1 END) AS leads_qualified,
        COUNT(CASE WHEN lead_status = 'converted' THEN 1 END) AS leads_converted,
        COUNT(CASE WHEN lead_source = 'inbound' THEN 1 END) AS leads_inbound_total,
        COUNT(CASE WHEN lead_source = 'outbound' THEN 1 END) AS leads_outbound_total
    FROM leads
),

opp_stats AS (
    SELECT
        COUNT(*) AS opportunities_total,
        COUNT(CASE WHEN stage NOT IN ('closed_won', 'closed_lost') THEN 1 END) AS open_opportunities,
        COUNT(CASE WHEN stage = 'closed_won' THEN 1 END) AS won_opportunities,
        COUNT(CASE WHEN stage = 'closed_lost' THEN 1 END) AS lost_opportunities,
        SUM(CASE WHEN stage NOT IN ('closed_won', 'closed_lost') THEN COALESCE(amount_usd, 0) ELSE 0 END) AS open_pipeline_usd,
        SUM(CASE WHEN stage = 'closed_won' THEN COALESCE(amount_usd, 0) ELSE 0 END) AS won_revenue_usd
    FROM opportunities
)

SELECT
    CURRENT_DATE AS as_of_date,
    ls.leads_total,
    ls.leads_new,
    ls.leads_working,
    ls.leads_nurturing,
    ls.leads_qualified,
    ls.leads_converted,
    ls.leads_inbound_total,
    ls.leads_outbound_total,
    os.opportunities_total,
    os.open_opportunities,
    os.won_opportunities,
    os.lost_opportunities,
    COALESCE(os.open_pipeline_usd, 0) AS open_pipeline_usd,
    COALESCE(os.won_revenue_usd, 0) AS won_revenue_usd,
    ROUND(ls.leads_converted::DECIMAL / NULLIF(ls.leads_total, 0) * 100, 2) AS lead_conversion_rate_pct,
    ROUND(os.won_opportunities::DECIMAL / NULLIF(os.opportunities_total, 0) * 100, 2) AS opportunity_win_rate_pct,
    CURRENT_TIMESTAMP AS _calculated_at
FROM lead_stats ls
CROSS JOIN opp_stats os
