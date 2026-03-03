-- =============================================================================
-- FACT TABLE: GTM Campaign and Channel Performance
-- =============================================================================
-- Grain: 1 row per campaign x month
-- Purpose: Campaign/channel attribution from lead first touch to revenue outcomes
-- =============================================================================

WITH lead_touches AS (
    SELECT * FROM {{ ref('stg_gtm_lead_touches') }}
),

campaigns AS (
    SELECT * FROM {{ ref('stg_gtm_campaigns') }}
),

leads AS (
    SELECT * FROM {{ ref('stg_gtm_leads') }}
),

opportunities AS (
    SELECT * FROM {{ ref('stg_gtm_opportunities') }}
),

employees AS (
    SELECT employee_id, full_name, employee_email
    FROM {{ ref('stg_gtm_employees') }}
),

-- Attribute each lead to its first captured touch
lead_first_touch AS (
    SELECT
        lt.lead_id,
        lt.campaign_id,
        COALESCE(NULLIF(TRIM(lt.channel), ''), c.channel, 'unknown') AS attributed_channel,
        lt.touch_at,
        ROW_NUMBER() OVER (
            PARTITION BY lt.lead_id
            ORDER BY lt.touch_at ASC, lt.created_at ASC
        ) AS touch_rank
    FROM lead_touches lt
    LEFT JOIN campaigns c ON lt.campaign_id = c.campaign_id
),

attributed_leads AS (
    SELECT
        l.lead_id,
        l.account_id,
        l.owner_employee_id,
        l.lead_source,
        l.lead_status,
        l.created_at AS lead_created_at,
        l.converted_at,
        lft.campaign_id,
        COALESCE(lft.attributed_channel, l.lead_source, 'unknown') AS channel
    FROM leads l
    LEFT JOIN lead_first_touch lft
        ON l.lead_id = lft.lead_id
       AND lft.touch_rank = 1
),

opportunity_outcomes AS (
    SELECT
        o.originating_lead_id AS lead_id,
        COUNT(*) AS opportunities_total,
        COUNT(CASE WHEN o.stage = 'closed_won' THEN 1 END) AS opportunities_won,
        SUM(CASE WHEN o.stage = 'closed_won' THEN COALESCE(o.amount_usd, 0) ELSE 0 END) AS won_revenue_usd
    FROM opportunities o
    GROUP BY 1
),

monthly_rollup AS (
    SELECT
        DATE_TRUNC('month', al.lead_created_at)::DATE AS metric_month,
        COALESCE(al.campaign_id, 'unattributed') AS campaign_id,
        COALESCE(c.campaign_name, 'Unattributed') AS campaign_name,
        COALESCE(al.channel, c.channel, 'unknown') AS channel,
        COALESCE(c.owner_employee_id, al.owner_employee_id) AS owner_employee_id,

        COUNT(*) AS leads_created,
        COUNT(CASE WHEN al.lead_status = 'qualified' THEN 1 END) AS leads_qualified,
        COUNT(CASE WHEN al.converted_at IS NOT NULL THEN 1 END) AS leads_converted,
        SUM(COALESCE(oo.opportunities_total, 0)) AS opportunities_total,
        SUM(COALESCE(oo.opportunities_won, 0)) AS opportunities_won,
        SUM(COALESCE(oo.won_revenue_usd, 0)) AS won_revenue_usd,

        SUM(COALESCE(c.budget_usd, 0)) AS campaign_budget_usd
    FROM attributed_leads al
    LEFT JOIN opportunity_outcomes oo ON al.lead_id = oo.lead_id
    LEFT JOIN campaigns c ON al.campaign_id = c.campaign_id
    GROUP BY 1, 2, 3, 4, 5
),

final AS (
    SELECT
        mr.metric_month,
        mr.campaign_id,
        mr.campaign_name,
        mr.channel,
        mr.owner_employee_id,
        e.full_name AS owner_name,
        e.employee_email AS owner_email,

        mr.leads_created,
        mr.leads_qualified,
        mr.leads_converted,
        mr.opportunities_total,
        mr.opportunities_won,
        mr.won_revenue_usd,
        mr.campaign_budget_usd,

        ROUND(mr.leads_qualified::DECIMAL / NULLIF(mr.leads_created, 0) * 100, 2) AS lead_qualification_rate_pct,
        ROUND(mr.leads_converted::DECIMAL / NULLIF(mr.leads_created, 0) * 100, 2) AS lead_conversion_rate_pct,
        ROUND(mr.opportunities_won::DECIMAL / NULLIF(mr.opportunities_total, 0) * 100, 2) AS opportunity_win_rate_pct,
        ROUND(mr.won_revenue_usd / NULLIF(mr.campaign_budget_usd, 0), 4) AS campaign_roas,

        CURRENT_TIMESTAMP AS _loaded_at
    FROM monthly_rollup mr
    LEFT JOIN employees e ON mr.owner_employee_id = e.employee_id
)

SELECT * FROM final
