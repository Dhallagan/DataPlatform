{{ config(alias='dim_lifecycle_accounts') }}

-- =============================================================================
-- DIMENSION: GTM Lifecycle Accounts
-- =============================================================================
-- Grain: 1 row per GTM account
-- Purpose: Lifecycle spine for prospect -> paid -> using -> staying reporting
-- =============================================================================

WITH accounts AS (
    SELECT * FROM {{ ref('stg_gtm_accounts') }}
),

employees AS (
    SELECT employee_id, full_name, employee_email
    FROM {{ ref('stg_gtm_employees') }}
),

leads AS (
    SELECT * FROM {{ ref('stg_gtm_leads') }}
),

opportunities AS (
    SELECT * FROM {{ ref('stg_gtm_opportunities') }}
),

activities AS (
    SELECT * FROM {{ ref('stg_gtm_activities') }}
),

organizations AS (
    SELECT organization_id, organization_status, is_paying_customer
    FROM {{ ref('organizations') }}
),

sessions AS (
    SELECT organization_id, started_at
    FROM {{ ref('sessions') }}
),

monthly_revenue AS (
    SELECT organization_id, revenue_month, realized_revenue_usd
    FROM {{ ref('monthly_revenue') }}
),

lead_stats AS (
    SELECT
        l.account_id,
        COUNT(*) AS leads_total,
        COUNT(CASE WHEN l.lead_status = 'qualified' THEN 1 END) AS leads_qualified,
        COUNT(CASE WHEN l.lead_status = 'converted' THEN 1 END) AS leads_converted,
        MIN(l.created_at) AS first_prospect_at,
        MIN(CASE WHEN l.lead_status IN ('qualified', 'converted') THEN l.updated_at END) AS first_qualified_at,
        MIN(l.converted_at) AS first_lead_converted_at,
        MAX(l.created_at) AS last_lead_at,
        MIN(l.owner_employee_id) AS first_lead_owner_employee_id
    FROM leads l
    GROUP BY 1
),

opportunity_stats AS (
    SELECT
        o.account_id,
        COUNT(*) AS opportunities_total,
        COUNT(CASE WHEN o.stage NOT IN ('closed_won', 'closed_lost') THEN 1 END) AS open_opportunities,
        COUNT(CASE WHEN o.stage = 'closed_won' THEN 1 END) AS won_opportunities,
        COUNT(CASE WHEN o.stage = 'closed_lost' THEN 1 END) AS lost_opportunities,
        SUM(CASE WHEN o.stage = 'closed_won' THEN COALESCE(o.amount_usd, 0) ELSE 0 END) AS won_revenue_usd,
        MIN(o.created_at) AS first_opportunity_at,
        MIN(CASE WHEN o.stage = 'closed_won' THEN o.closed_at END) AS first_closed_won_at,
        MAX(o.closed_at) AS last_closed_at,
        MIN(o.owner_employee_id) AS first_opportunity_owner_employee_id
    FROM opportunities o
    GROUP BY 1
),

activity_stats AS (
    SELECT
        a.account_id,
        COUNT(*) AS activities_total,
        COUNT(CASE WHEN a.activity_type = 'email' THEN 1 END) AS emails_total,
        COUNT(CASE WHEN a.activity_type = 'call' THEN 1 END) AS calls_total,
        COUNT(CASE WHEN a.activity_type = 'meeting' THEN 1 END) AS meetings_total,
        MIN(a.occurred_at) AS first_activity_at,
        MAX(a.occurred_at) AS last_activity_at
    FROM activities a
    WHERE a.account_id IS NOT NULL
    GROUP BY 1
),

billing_stats AS (
    SELECT
        mr.organization_id,
        MIN(CASE WHEN mr.realized_revenue_usd > 0 THEN mr.revenue_month END) AS first_paid_month,
        SUM(COALESCE(mr.realized_revenue_usd, 0)) AS lifetime_realized_revenue_usd
    FROM monthly_revenue mr
    GROUP BY 1
),

usage_stats AS (
    SELECT
        s.organization_id,
        MIN(s.started_at) AS first_product_usage_at,
        MAX(s.started_at) AS last_product_usage_at,
        COUNT(*) AS lifetime_sessions
    FROM sessions s
    GROUP BY 1
),

final AS (
    SELECT
        a.account_id,
        a.organization_id,
        a.account_name,
        a.account_status,
        a.account_tier,
        a.industry,
        a.employee_band,
        a.source_system,

        a.owner_employee_id AS account_owner_employee_id,
        account_owner.full_name AS account_owner_name,
        account_owner.employee_email AS account_owner_email,

        ls.first_lead_owner_employee_id,
        lead_owner.full_name AS first_lead_owner_name,
        os.first_opportunity_owner_employee_id,
        opp_owner.full_name AS first_opportunity_owner_name,

        COALESCE(ls.leads_total, 0) AS leads_total,
        COALESCE(ls.leads_qualified, 0) AS leads_qualified,
        COALESCE(ls.leads_converted, 0) AS leads_converted,

        COALESCE(os.opportunities_total, 0) AS opportunities_total,
        COALESCE(os.open_opportunities, 0) AS open_opportunities,
        COALESCE(os.won_opportunities, 0) AS won_opportunities,
        COALESCE(os.lost_opportunities, 0) AS lost_opportunities,
        COALESCE(os.won_revenue_usd, 0) AS won_revenue_usd,

        COALESCE(ac.activities_total, 0) AS activities_total,
        COALESCE(ac.emails_total, 0) AS emails_total,
        COALESCE(ac.calls_total, 0) AS calls_total,
        COALESCE(ac.meetings_total, 0) AS meetings_total,

        ls.first_prospect_at,
        ls.first_qualified_at,
        os.first_opportunity_at,
        os.first_closed_won_at,
        (bs.first_paid_month)::TIMESTAMP AS first_paid_at,
        us.first_product_usage_at,
        us.last_product_usage_at,
        ac.last_activity_at,

        ROUND(EXTRACT(EPOCH FROM (ls.first_qualified_at - ls.first_prospect_at)) / 86400.0, 2) AS days_prospect_to_qualified,
        ROUND(EXTRACT(EPOCH FROM (os.first_opportunity_at - ls.first_qualified_at)) / 86400.0, 2) AS days_qualified_to_opportunity,
        ROUND(EXTRACT(EPOCH FROM (os.first_closed_won_at - os.first_opportunity_at)) / 86400.0, 2) AS days_opportunity_to_closed_won,
        ROUND(EXTRACT(EPOCH FROM ((bs.first_paid_month)::TIMESTAMP - os.first_closed_won_at)) / 86400.0, 2) AS days_closed_won_to_paid,

        COALESCE(bs.lifetime_realized_revenue_usd, 0) AS lifetime_realized_revenue_usd,
        COALESCE(us.lifetime_sessions, 0) AS lifetime_sessions,

        CASE WHEN bs.first_paid_month IS NOT NULL OR org.is_paying_customer THEN TRUE ELSE FALSE END AS did_pay,
        CASE WHEN us.first_product_usage_at IS NOT NULL THEN TRUE ELSE FALSE END AS is_using,
        CASE
            WHEN us.first_product_usage_at IS NOT NULL
                AND us.last_product_usage_at >= us.first_product_usage_at + INTERVAL '30 days'
            THEN TRUE
            ELSE FALSE
        END AS is_staying_30d,

        CASE
            WHEN org.organization_status = 'churned' THEN 'churned'
            WHEN us.first_product_usage_at IS NOT NULL
                AND us.last_product_usage_at >= us.first_product_usage_at + INTERVAL '30 days' THEN 'retained_customer'
            WHEN us.first_product_usage_at IS NOT NULL THEN 'active_customer'
            WHEN bs.first_paid_month IS NOT NULL OR org.is_paying_customer THEN 'paid_customer'
            WHEN os.first_closed_won_at IS NOT NULL THEN 'closed_won'
            WHEN os.first_opportunity_at IS NOT NULL THEN 'opportunity'
            WHEN ls.first_qualified_at IS NOT NULL THEN 'qualified'
            WHEN ls.first_prospect_at IS NOT NULL THEN 'prospect'
            ELSE 'target'
        END AS lifecycle_stage,

        a.created_at AS account_created_at,
        a.updated_at AS account_updated_at,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM accounts a
    LEFT JOIN organizations org ON a.organization_id = org.organization_id
    LEFT JOIN lead_stats ls ON a.account_id = ls.account_id
    LEFT JOIN opportunity_stats os ON a.account_id = os.account_id
    LEFT JOIN activity_stats ac ON a.account_id = ac.account_id
    LEFT JOIN billing_stats bs ON a.organization_id = bs.organization_id
    LEFT JOIN usage_stats us ON a.organization_id = us.organization_id
    LEFT JOIN employees account_owner ON a.owner_employee_id = account_owner.employee_id
    LEFT JOIN employees lead_owner ON ls.first_lead_owner_employee_id = lead_owner.employee_id
    LEFT JOIN employees opp_owner ON os.first_opportunity_owner_employee_id = opp_owner.employee_id
)

SELECT * FROM final
