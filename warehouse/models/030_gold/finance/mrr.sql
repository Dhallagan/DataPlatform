{{ config(alias='snap_mrr') }}

-- =============================================================================
-- METRIC VIEW: Monthly Recurring Revenue (MRR)
-- =============================================================================
-- Definition: Sum of monthly subscription values for active subscriptions
-- Purpose: Canonical MRR metric for executive dashboards
-- =============================================================================

WITH active_subscriptions AS (
    SELECT
        s.subscription_id,
        s.organization_id,
        s.plan_id,
        s.status,
        s.current_period_start,
        s.current_period_end
    FROM {{ ref('stg_subscriptions') }} s
    WHERE s.status = 'active'
),

plans AS (
    SELECT
        plan_id,
        plan_name,
        monthly_price_usd
    FROM {{ ref('stg_plans') }}
),

organizations AS (
    SELECT
        organization_id,
        organization_name,
        status as organization_status
    FROM {{ ref('stg_organizations') }}
)

SELECT
    -- As of date
    CURRENT_DATE AS as_of_date,
    
    -- Total MRR
    SUM(p.monthly_price_usd) AS total_mrr_usd,
    
    -- MRR by Plan
    SUM(CASE WHEN p.plan_name = 'starter' THEN p.monthly_price_usd ELSE 0 END) AS starter_mrr_usd,
    SUM(CASE WHEN p.plan_name = 'pro' THEN p.monthly_price_usd ELSE 0 END) AS pro_mrr_usd,
    SUM(CASE WHEN p.plan_name = 'enterprise' THEN p.monthly_price_usd ELSE 0 END) AS enterprise_mrr_usd,
    
    -- Subscriber Counts
    COUNT(DISTINCT a.organization_id) AS total_paying_customers,
    COUNT(DISTINCT CASE WHEN p.plan_name = 'starter' THEN a.organization_id END) AS starter_customers,
    COUNT(DISTINCT CASE WHEN p.plan_name = 'pro' THEN a.organization_id END) AS pro_customers,
    COUNT(DISTINCT CASE WHEN p.plan_name = 'enterprise' THEN a.organization_id END) AS enterprise_customers,
    
    -- ARPU (Average Revenue Per User)
    ROUND(
        SUM(p.monthly_price_usd)::NUMERIC / NULLIF(COUNT(DISTINCT a.organization_id), 0),
        2
    ) AS arpu_usd,
    
    -- Metadata
    CURRENT_TIMESTAMP AS _calculated_at

FROM active_subscriptions a
JOIN plans p ON a.plan_id = p.plan_id
JOIN organizations o ON a.organization_id = o.organization_id
WHERE o.organization_status = 'active'
  AND p.monthly_price_usd > 0  -- Exclude free plans from MRR
