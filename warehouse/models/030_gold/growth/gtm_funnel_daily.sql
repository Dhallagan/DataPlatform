{{ config(alias='agg_funnel_daily') }}

-- =============================================================================
-- FACT VIEW: GTM Funnel Daily
-- =============================================================================
-- Grain: 1 row per day
-- Purpose: Daily inbound/outbound lead and pipeline progression metrics
-- =============================================================================

WITH leads AS (
    SELECT * FROM {{ ref('stg_gtm_leads') }}
),

opportunities AS (
    SELECT * FROM {{ ref('stg_gtm_opportunities') }}
),

calendar AS (
    SELECT DISTINCT DATE(created_at) AS metric_date FROM leads
    UNION
    SELECT DISTINCT DATE(converted_at) AS metric_date FROM leads WHERE converted_at IS NOT NULL
    UNION
    SELECT DISTINCT DATE(created_at) AS metric_date FROM opportunities
    UNION
    SELECT DISTINCT DATE(closed_at) AS metric_date FROM opportunities WHERE closed_at IS NOT NULL
),

daily_leads AS (
    SELECT
        DATE(created_at) AS metric_date,
        COUNT(*) AS leads_created,
        COUNT(CASE WHEN lead_source = 'inbound' THEN 1 END) AS inbound_leads,
        COUNT(CASE WHEN lead_source = 'outbound' THEN 1 END) AS outbound_leads,
        COUNT(CASE WHEN lead_status = 'qualified' THEN 1 END) AS qualified_leads_created
    FROM leads
    GROUP BY 1
),

daily_conversions AS (
    SELECT
        DATE(converted_at) AS metric_date,
        COUNT(*) AS leads_converted
    FROM leads
    WHERE converted_at IS NOT NULL
    GROUP BY 1
),

daily_opportunities AS (
    SELECT
        DATE(created_at) AS metric_date,
        COUNT(*) AS opportunities_created,
        SUM(COALESCE(amount_usd, 0)) AS opportunities_amount_created_usd
    FROM opportunities
    GROUP BY 1
),

daily_closed_won AS (
    SELECT
        DATE(closed_at) AS metric_date,
        COUNT(*) AS opportunities_closed_won,
        SUM(COALESCE(amount_usd, 0)) AS closed_won_amount_usd
    FROM opportunities
    WHERE stage = 'closed_won'
      AND closed_at IS NOT NULL
    GROUP BY 1
),

final AS (
    SELECT
        c.metric_date,
        COALESCE(dl.leads_created, 0) AS leads_created,
        COALESCE(dl.inbound_leads, 0) AS inbound_leads,
        COALESCE(dl.outbound_leads, 0) AS outbound_leads,
        COALESCE(dl.qualified_leads_created, 0) AS qualified_leads_created,
        COALESCE(dc.leads_converted, 0) AS leads_converted,
        COALESCE(dop.opportunities_created, 0) AS opportunities_created,
        COALESCE(dop.opportunities_amount_created_usd, 0) AS opportunities_amount_created_usd,
        COALESCE(dcw.opportunities_closed_won, 0) AS opportunities_closed_won,
        COALESCE(dcw.closed_won_amount_usd, 0) AS closed_won_amount_usd,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM calendar c
    LEFT JOIN daily_leads dl ON c.metric_date = dl.metric_date
    LEFT JOIN daily_conversions dc ON c.metric_date = dc.metric_date
    LEFT JOIN daily_opportunities dop ON c.metric_date = dop.metric_date
    LEFT JOIN daily_closed_won dcw ON c.metric_date = dcw.metric_date
)

SELECT * FROM final
