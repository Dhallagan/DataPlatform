-- =============================================================================
-- BROWSERBASE WAREHOUSE RECONCILIATION REPORTS
-- =============================================================================
-- Run these in MotherDuck / DuckDB against the warehouse + analytics databases.
-- Goal: prove that metric views align with their equivalent source logic.
-- =============================================================================


-- =============================================================================
-- R1) mrr snapshot vs equivalent rollup from silver models
-- =============================================================================
WITH view_snapshot AS (
    SELECT
        total_paying_customers,
        total_mrr_usd,
        starter_customers,
        pro_customers,
        enterprise_customers,
        starter_mrr_usd,
        pro_mrr_usd,
        enterprise_mrr_usd,
        arpu_usd
    FROM analytics.finance.mrr
    LIMIT 1
),
equivalent AS (
    WITH active_subscriptions AS (
        SELECT subscription_id, organization_id, plan_id
        FROM silver.stg_subscriptions
        WHERE status = 'active'
    ),
    plans AS (
        SELECT plan_id, plan_name, monthly_price_usd
        FROM silver.stg_plans
    ),
    organizations AS (
        SELECT organization_id, organization_status
        FROM silver.stg_organizations
    )
    SELECT
        COUNT(DISTINCT a.organization_id) AS total_paying_customers,
        SUM(p.monthly_price_usd) AS total_mrr_usd,
        COUNT(DISTINCT CASE WHEN p.plan_name = 'starter' THEN a.organization_id END) AS starter_customers,
        COUNT(DISTINCT CASE WHEN p.plan_name = 'pro' THEN a.organization_id END) AS pro_customers,
        COUNT(DISTINCT CASE WHEN p.plan_name = 'enterprise' THEN a.organization_id END) AS enterprise_customers,
        SUM(CASE WHEN p.plan_name = 'starter' THEN p.monthly_price_usd ELSE 0 END) AS starter_mrr_usd,
        SUM(CASE WHEN p.plan_name = 'pro' THEN p.monthly_price_usd ELSE 0 END) AS pro_mrr_usd,
        SUM(CASE WHEN p.plan_name = 'enterprise' THEN p.monthly_price_usd ELSE 0 END) AS enterprise_mrr_usd,
        ROUND(
            SUM(p.monthly_price_usd)::NUMERIC / NULLIF(COUNT(DISTINCT a.organization_id), 0),
            2
        ) AS arpu_usd
    FROM active_subscriptions a
    JOIN plans p ON a.plan_id = p.plan_id
    JOIN organizations o ON a.organization_id = o.organization_id
    WHERE o.organization_status = 'active'
      AND p.monthly_price_usd > 0
)
SELECT
    v.total_paying_customers AS view_total_paying_customers,
    e.total_paying_customers AS eq_total_paying_customers,
    v.total_paying_customers - e.total_paying_customers AS delta_total_paying_customers,
    v.total_mrr_usd AS view_total_mrr_usd,
    e.total_mrr_usd AS eq_total_mrr_usd,
    v.total_mrr_usd - e.total_mrr_usd AS delta_total_mrr_usd,
    v.arpu_usd AS view_arpu_usd,
    e.arpu_usd AS eq_arpu_usd,
    v.arpu_usd - e.arpu_usd AS delta_arpu_usd
FROM view_snapshot v
CROSS JOIN equivalent e;


-- =============================================================================
-- R2) mrr plan mix reconciliation
-- =============================================================================
WITH view_snapshot AS (
    SELECT
        starter_customers, pro_customers, enterprise_customers,
        starter_mrr_usd, pro_mrr_usd, enterprise_mrr_usd
    FROM analytics.finance.mrr
    LIMIT 1
),
equivalent AS (
    WITH active_subscriptions AS (
        SELECT organization_id, plan_id
        FROM silver.stg_subscriptions
        WHERE status = 'active'
    )
    SELECT
        COUNT(DISTINCT CASE WHEN p.plan_name = 'starter' THEN s.organization_id END) AS starter_customers,
        COUNT(DISTINCT CASE WHEN p.plan_name = 'pro' THEN s.organization_id END) AS pro_customers,
        COUNT(DISTINCT CASE WHEN p.plan_name = 'enterprise' THEN s.organization_id END) AS enterprise_customers,
        SUM(CASE WHEN p.plan_name = 'starter' THEN p.monthly_price_usd ELSE 0 END) AS starter_mrr_usd,
        SUM(CASE WHEN p.plan_name = 'pro' THEN p.monthly_price_usd ELSE 0 END) AS pro_mrr_usd,
        SUM(CASE WHEN p.plan_name = 'enterprise' THEN p.monthly_price_usd ELSE 0 END) AS enterprise_mrr_usd
    FROM active_subscriptions s
    JOIN silver.stg_plans p ON s.plan_id = p.plan_id
    JOIN silver.stg_organizations o ON s.organization_id = o.organization_id
    WHERE o.organization_status = 'active'
      AND p.monthly_price_usd > 0
)
SELECT
    v.starter_customers, e.starter_customers, v.starter_customers - e.starter_customers AS delta_starter_customers,
    v.pro_customers, e.pro_customers, v.pro_customers - e.pro_customers AS delta_pro_customers,
    v.enterprise_customers, e.enterprise_customers, v.enterprise_customers - e.enterprise_customers AS delta_enterprise_customers,
    v.starter_mrr_usd, e.starter_mrr_usd, v.starter_mrr_usd - e.starter_mrr_usd AS delta_starter_mrr_usd,
    v.pro_mrr_usd, e.pro_mrr_usd, v.pro_mrr_usd - e.pro_mrr_usd AS delta_pro_mrr_usd,
    v.enterprise_mrr_usd, e.enterprise_mrr_usd, v.enterprise_mrr_usd - e.enterprise_mrr_usd AS delta_enterprise_mrr_usd
FROM view_snapshot v
CROSS JOIN equivalent e;


-- =============================================================================
-- R3) active_organizations count vs equivalent from sessions
-- =============================================================================
WITH view_counts AS (
    SELECT
        COUNT(*) AS active_orgs_30d,
        COUNT(DISTINCT organization_id) AS distinct_active_orgs_30d
    FROM analytics.growth.active_organizations
),
equivalent AS (
    WITH org_activity AS (
        SELECT organization_id
        FROM silver.sessions
        WHERE session_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY organization_id
    )
    SELECT COUNT(*) AS active_orgs_30d
    FROM silver.organizations o
    JOIN org_activity a ON o.organization_id = a.organization_id
    WHERE o.organization_status = 'active'
)
SELECT
    v.active_orgs_30d AS view_active_orgs_30d,
    e.active_orgs_30d AS eq_active_orgs_30d,
    v.active_orgs_30d - e.active_orgs_30d AS delta_active_orgs_30d,
    v.distinct_active_orgs_30d AS view_distinct_active_orgs_30d
FROM view_counts v
CROSS JOIN equivalent e;


-- =============================================================================
-- R4) Paying vs Active overlap diagnostics
-- =============================================================================
WITH paying_orgs AS (
    SELECT DISTINCT organization_id
    FROM silver.stg_subscriptions
    WHERE status = 'active'
),
active_orgs AS (
    SELECT DISTINCT organization_id
    FROM analytics.growth.active_organizations
)
SELECT
    SUM(CASE WHEN p.organization_id IS NOT NULL AND a.organization_id IS NOT NULL THEN 1 ELSE 0 END) AS paying_and_active_30d,
    SUM(CASE WHEN p.organization_id IS NOT NULL AND a.organization_id IS NULL THEN 1 ELSE 0 END) AS paying_not_active_30d,
    SUM(CASE WHEN p.organization_id IS NULL AND a.organization_id IS NOT NULL THEN 1 ELSE 0 END) AS active_not_paying_30d
FROM (
    SELECT organization_id FROM paying_orgs
    UNION
    SELECT organization_id FROM active_orgs
) universe
LEFT JOIN paying_orgs p USING (organization_id)
LEFT JOIN active_orgs a USING (organization_id);


-- =============================================================================
-- R5) ARPU formula sanity check
-- =============================================================================
WITH m AS (
    SELECT total_mrr_usd, total_paying_customers, arpu_usd
    FROM analytics.finance.mrr
    LIMIT 1
)
SELECT
    total_mrr_usd,
    total_paying_customers,
    arpu_usd AS reported_arpu_usd,
    ROUND(total_mrr_usd / NULLIF(total_paying_customers, 0), 2) AS recomputed_arpu_usd,
    arpu_usd - ROUND(total_mrr_usd / NULLIF(total_paying_customers, 0), 2) AS delta_arpu_usd
FROM m;


-- =============================================================================
-- R6) Active tier distribution (quick weirdness detector)
-- =============================================================================
SELECT
    activity_tier,
    COUNT(*) AS organizations
FROM analytics.growth.active_organizations
GROUP BY 1
ORDER BY organizations DESC;
