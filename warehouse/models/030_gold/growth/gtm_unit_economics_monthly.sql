{{ config(alias='agg_unit_economics_monthly') }}

-- =============================================================================
-- FACT TABLE: GTM Unit Economics Monthly
-- =============================================================================
-- Grain: 1 row per month
-- Purpose: CAC/LTV-oriented KPI layer for GTM lifecycle and campaign efficiency
-- =============================================================================

WITH lifecycle_accounts AS (
    SELECT * FROM {{ ref('gtm_lifecycle_accounts') }}
),

campaign_performance AS (
    SELECT * FROM {{ ref('gtm_campaign_channel_performance') }}
),

monthly_revenue AS (
    SELECT
        revenue_month,
        organization_id,
        realized_revenue_usd
    FROM {{ ref('monthly_revenue') }}
),

lifecycle_monthly AS (
    SELECT
        DATE_TRUNC('month', account_created_at)::DATE AS metric_month,
        COUNT(*) AS new_accounts
    FROM lifecycle_accounts
    GROUP BY 1
),

prospect_monthly AS (
    SELECT
        DATE_TRUNC('month', first_prospect_at)::DATE AS metric_month,
        COUNT(*) AS new_prospects
    FROM lifecycle_accounts
    WHERE first_prospect_at IS NOT NULL
    GROUP BY 1
),

paid_monthly AS (
    SELECT
        DATE_TRUNC('month', first_paid_at)::DATE AS metric_month,
        COUNT(*) AS new_paid_customers
    FROM lifecycle_accounts
    WHERE first_paid_at IS NOT NULL
    GROUP BY 1
),

using_monthly AS (
    SELECT
        DATE_TRUNC('month', first_product_usage_at)::DATE AS metric_month,
        COUNT(*) AS new_using_customers,
        COUNT(CASE WHEN is_staying_30d THEN 1 END) AS retained_30d_customers
    FROM lifecycle_accounts
    WHERE first_product_usage_at IS NOT NULL
    GROUP BY 1
),

campaign_monthly AS (
    SELECT
        metric_month,
        SUM(campaign_budget_usd) AS campaign_spend_usd,
        SUM(won_revenue_usd) AS pipeline_won_revenue_usd,
        SUM(leads_created) AS leads_created,
        SUM(leads_qualified) AS leads_qualified,
        SUM(leads_converted) AS leads_converted,
        SUM(opportunities_total) AS opportunities_total,
        SUM(opportunities_won) AS opportunities_won
    FROM campaign_performance
    GROUP BY 1
),

revenue_monthly AS (
    SELECT
        revenue_month AS metric_month,
        SUM(realized_revenue_usd) AS realized_revenue_usd,
        COUNT(DISTINCT CASE WHEN realized_revenue_usd > 0 THEN organization_id END) AS paying_customers_in_month
    FROM monthly_revenue
    GROUP BY 1
),

calendar AS (
    SELECT metric_month FROM lifecycle_monthly
    UNION
    SELECT metric_month FROM prospect_monthly
    UNION
    SELECT metric_month FROM paid_monthly
    UNION
    SELECT metric_month FROM using_monthly
    UNION
    SELECT metric_month FROM campaign_monthly
    UNION
    SELECT metric_month FROM revenue_monthly
),

final AS (
    SELECT
        c.metric_month,

        COALESCE(lm.new_accounts, 0) AS new_accounts,
        COALESCE(pm.new_prospects, 0) AS new_prospects,
        COALESCE(pdm.new_paid_customers, 0) AS new_paid_customers,
        COALESCE(um.new_using_customers, 0) AS new_using_customers,
        COALESCE(um.retained_30d_customers, 0) AS retained_30d_customers,

        COALESCE(cm.leads_created, 0) AS leads_created,
        COALESCE(cm.leads_qualified, 0) AS leads_qualified,
        COALESCE(cm.leads_converted, 0) AS leads_converted,
        COALESCE(cm.opportunities_total, 0) AS opportunities_total,
        COALESCE(cm.opportunities_won, 0) AS opportunities_won,

        COALESCE(cm.campaign_spend_usd, 0) AS campaign_spend_usd,
        COALESCE(cm.pipeline_won_revenue_usd, 0) AS pipeline_won_revenue_usd,
        COALESCE(rm.realized_revenue_usd, 0) AS realized_revenue_usd,
        COALESCE(rm.paying_customers_in_month, 0) AS paying_customers_in_month,

        ROUND(COALESCE(cm.campaign_spend_usd, 0) / NULLIF(COALESCE(pdm.new_paid_customers, 0), 0), 2) AS cac_usd,
        ROUND(COALESCE(rm.realized_revenue_usd, 0) / NULLIF(COALESCE(rm.paying_customers_in_month, 0), 0), 2) AS arpu_usd,
        ROUND(COALESCE(um.retained_30d_customers, 0)::DECIMAL / NULLIF(COALESCE(pdm.new_paid_customers, 0), 0), 4) AS retention_30d_rate,
        ROUND(COALESCE(cm.pipeline_won_revenue_usd, 0) / NULLIF(COALESCE(cm.campaign_spend_usd, 0), 0), 4) AS pipeline_roas,

        ROUND(
            (COALESCE(rm.realized_revenue_usd, 0) / NULLIF(COALESCE(rm.paying_customers_in_month, 0), 0))
            * (
                (COALESCE(um.retained_30d_customers, 0)::DECIMAL / NULLIF(COALESCE(pdm.new_paid_customers, 0), 0))
                / NULLIF(1 - (COALESCE(um.retained_30d_customers, 0)::DECIMAL / NULLIF(COALESCE(pdm.new_paid_customers, 0), 0)), 0)
            ),
            2
        ) AS ltv_proxy_usd,

        CURRENT_TIMESTAMP AS _loaded_at
    FROM calendar c
    LEFT JOIN lifecycle_monthly lm ON c.metric_month = lm.metric_month
    LEFT JOIN prospect_monthly pm ON c.metric_month = pm.metric_month
    LEFT JOIN paid_monthly pdm ON c.metric_month = pdm.metric_month
    LEFT JOIN using_monthly um ON c.metric_month = um.metric_month
    LEFT JOIN campaign_monthly cm ON c.metric_month = cm.metric_month
    LEFT JOIN revenue_monthly rm ON c.metric_month = rm.metric_month
)

SELECT * FROM final
