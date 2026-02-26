-- =============================================================================
-- BROWSERBASE ANALYTICS QUERIES
-- =============================================================================
-- Run these in Supabase SQL Editor
-- https://supabase.com/dashboard/project/ixmbjqcguznhdwhbiuop/sql
-- =============================================================================


-- =============================================================================
-- 1. EXECUTIVE DASHBOARD METRICS
-- =============================================================================

-- 1.1 Key Business Metrics (run this first!)
SELECT 
    (SELECT COUNT(*) FROM organizations WHERE status = 'active') as active_orgs,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM browser_sessions) as total_sessions,
    (SELECT COUNT(*) FROM browser_sessions WHERE status = 'completed') as successful_sessions,
    (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 1) FROM browser_sessions) as success_rate_pct,
    (SELECT COALESCE(SUM(p.monthly_price), 0) 
     FROM subscriptions s 
     JOIN plans p ON s.plan_id = p.id 
     WHERE s.status = 'active' AND p.monthly_price > 0) as mrr_usd;


-- 1.2 MRR by Plan Tier
SELECT 
    p.name as plan,
    p.monthly_price as price,
    COUNT(DISTINCT s.organization_id) as customers,
    SUM(p.monthly_price) as mrr
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.status = 'active'
GROUP BY p.name, p.monthly_price
ORDER BY mrr DESC;


-- 1.3 Daily Active Organizations (last 30 days)
SELECT 
    DATE(created_at) as day,
    COUNT(DISTINCT organization_id) as active_orgs,
    COUNT(*) as sessions
FROM browser_sessions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;


-- =============================================================================
-- 2. PRODUCT ANALYTICS
-- =============================================================================

-- 2.1 Session Success Rate by Day
SELECT 
    DATE(created_at) as day,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'timeout') as timeout,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 1) as success_rate
FROM browser_sessions
GROUP BY DATE(created_at)
ORDER BY day DESC
LIMIT 30;


-- 2.2 Top Organizations by Usage
SELECT 
    o.name as organization,
    o.status,
    p.name as plan,
    COUNT(s.id) as total_sessions,
    COUNT(s.id) FILTER (WHERE s.status = 'completed') as successful,
    ROUND(100.0 * COUNT(s.id) FILTER (WHERE s.status = 'completed') / NULLIF(COUNT(s.id), 0), 1) as success_rate,
    SUM(s.pages_visited) as pages_visited,
    ROUND(SUM(s.bytes_downloaded) / 1024.0 / 1024.0, 2) as mb_downloaded
FROM organizations o
LEFT JOIN browser_sessions s ON o.id = s.organization_id
LEFT JOIN subscriptions sub ON o.id = sub.organization_id AND sub.status = 'active'
LEFT JOIN plans p ON sub.plan_id = p.id
GROUP BY o.id, o.name, o.status, p.name
ORDER BY total_sessions DESC
LIMIT 20;


-- 2.3 Browser Type Distribution
SELECT 
    browser_type,
    COUNT(*) as sessions,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 1) as success_rate
FROM browser_sessions
GROUP BY browser_type
ORDER BY sessions DESC;


-- 2.4 Proxy Usage Analysis
SELECT 
    COALESCE(proxy_type, 'no_proxy') as proxy_type,
    COUNT(*) as sessions,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 1) as success_rate,
    ROUND(AVG(EXTRACT(EPOCH FROM (ended_at - started_at))), 1) as avg_duration_sec
FROM browser_sessions
GROUP BY proxy_type
ORDER BY sessions DESC;


-- 2.5 Session Duration Distribution
SELECT 
    CASE 
        WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) < 60 THEN '< 1 min'
        WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) < 300 THEN '1-5 min'
        WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) < 900 THEN '5-15 min'
        WHEN EXTRACT(EPOCH FROM (ended_at - started_at)) < 1800 THEN '15-30 min'
        ELSE '> 30 min'
    END as duration_bucket,
    COUNT(*) as sessions,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct
FROM browser_sessions
WHERE ended_at IS NOT NULL
GROUP BY 1
ORDER BY MIN(EXTRACT(EPOCH FROM (ended_at - started_at)));


-- 2.6 Most Visited Domains
SELECT 
    SPLIT_PART(SPLIT_PART(initial_url, '://', 2), '/', 1) as domain,
    COUNT(*) as sessions,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 1) as success_rate
FROM browser_sessions
WHERE initial_url IS NOT NULL
GROUP BY 1
ORDER BY sessions DESC
LIMIT 15;


-- =============================================================================
-- 3. GROWTH METRICS
-- =============================================================================

-- 3.1 Weekly Signups
SELECT 
    DATE_TRUNC('week', created_at)::date as week,
    COUNT(*) as new_organizations
FROM organizations
GROUP BY 1
ORDER BY 1 DESC
LIMIT 12;


-- 3.2 User Growth by Week
SELECT 
    DATE_TRUNC('week', created_at)::date as week,
    COUNT(*) as new_users,
    SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('week', created_at)) as cumulative_users
FROM users
GROUP BY 1
ORDER BY 1;


-- 3.3 Activation Rate (orgs that used the product within 7 days of signup)
WITH org_first_session AS (
    SELECT 
        organization_id,
        MIN(created_at) as first_session_at
    FROM browser_sessions
    GROUP BY organization_id
)
SELECT 
    DATE_TRUNC('week', o.created_at)::date as signup_week,
    COUNT(*) as signups,
    COUNT(fs.organization_id) as activated,
    ROUND(100.0 * COUNT(fs.organization_id) / COUNT(*), 1) as activation_rate
FROM organizations o
LEFT JOIN org_first_session fs 
    ON o.id = fs.organization_id 
    AND fs.first_session_at <= o.created_at + INTERVAL '7 days'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 12;


-- =============================================================================
-- 4. RETENTION & COHORTS
-- =============================================================================

-- 4.1 Weekly Cohort Retention
WITH cohorts AS (
    SELECT 
        id as organization_id,
        DATE_TRUNC('week', created_at)::date as cohort_week
    FROM organizations
),
weekly_activity AS (
    SELECT DISTINCT
        organization_id,
        DATE_TRUNC('week', created_at)::date as activity_week
    FROM browser_sessions
),
retention AS (
    SELECT 
        c.cohort_week,
        (wa.activity_week - c.cohort_week) / 7 as weeks_since_signup,
        COUNT(DISTINCT wa.organization_id) as active_orgs
    FROM cohorts c
    LEFT JOIN weekly_activity wa ON c.organization_id = wa.organization_id
        AND wa.activity_week >= c.cohort_week
    GROUP BY 1, 2
)
SELECT 
    cohort_week,
    weeks_since_signup,
    active_orgs,
    ROUND(100.0 * active_orgs / FIRST_VALUE(active_orgs) OVER (PARTITION BY cohort_week ORDER BY weeks_since_signup), 1) as retention_pct
FROM retention
WHERE weeks_since_signup <= 8
ORDER BY cohort_week DESC, weeks_since_signup;


-- 4.2 Churn Analysis (orgs with no activity in last 30 days)
SELECT 
    p.name as plan,
    COUNT(*) as total_orgs,
    COUNT(*) FILTER (WHERE last_session > NOW() - INTERVAL '30 days') as active,
    COUNT(*) FILTER (WHERE last_session <= NOW() - INTERVAL '30 days' OR last_session IS NULL) as churned,
    ROUND(100.0 * COUNT(*) FILTER (WHERE last_session <= NOW() - INTERVAL '30 days' OR last_session IS NULL) / COUNT(*), 1) as churn_pct
FROM organizations o
LEFT JOIN (
    SELECT organization_id, MAX(created_at) as last_session
    FROM browser_sessions
    GROUP BY organization_id
) s ON o.id = s.organization_id
LEFT JOIN subscriptions sub ON o.id = sub.organization_id AND sub.status = 'active'
LEFT JOIN plans p ON sub.plan_id = p.id
WHERE o.status = 'active'
GROUP BY p.name
ORDER BY total_orgs DESC;


-- =============================================================================
-- 5. REVENUE ANALYTICS
-- =============================================================================

-- 5.1 Monthly Revenue
SELECT 
    DATE_TRUNC('month', period_start)::date as month,
    COUNT(*) as invoices,
    SUM(total) / 100.0 as total_revenue,
    SUM(total) FILTER (WHERE status = 'paid') / 100.0 as collected_revenue,
    ROUND(100.0 * SUM(total) FILTER (WHERE status = 'paid') / NULLIF(SUM(total), 0), 1) as collection_rate
FROM invoices
GROUP BY 1
ORDER BY 1 DESC;


-- 5.2 Revenue by Organization (Top 10)
SELECT 
    o.name,
    p.name as plan,
    COUNT(i.id) as invoices,
    SUM(i.total) / 100.0 as total_billed,
    SUM(i.total) FILTER (WHERE i.status = 'paid') / 100.0 as total_paid
FROM organizations o
JOIN invoices i ON o.id = i.organization_id
LEFT JOIN subscriptions s ON o.id = s.organization_id AND s.status = 'active'
LEFT JOIN plans p ON s.plan_id = p.id
GROUP BY o.id, o.name, p.name
ORDER BY total_billed DESC
LIMIT 10;


-- 5.3 Average Revenue Per User (ARPU) Trend
SELECT 
    DATE_TRUNC('month', i.period_start)::date as month,
    SUM(i.total) / 100.0 as revenue,
    COUNT(DISTINCT i.organization_id) as paying_orgs,
    ROUND(SUM(i.total) / 100.0 / NULLIF(COUNT(DISTINCT i.organization_id), 0), 2) as arpu
FROM invoices i
WHERE i.status = 'paid'
GROUP BY 1
ORDER BY 1;


-- =============================================================================
-- 6. OPERATIONAL METRICS
-- =============================================================================

-- 6.1 Error Analysis by Event Type
SELECT 
    event_type,
    COUNT(*) as events,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct
FROM session_events
GROUP BY event_type
ORDER BY events DESC;


-- 6.2 Session Failures by Hour (find problematic times)
SELECT 
    EXTRACT(HOUR FROM created_at) as hour_utc,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'failed') / COUNT(*), 1) as failure_rate
FROM browser_sessions
GROUP BY 1
ORDER BY 1;


-- 6.3 API Key Usage
SELECT 
    k.name as key_name,
    o.name as organization,
    COUNT(s.id) as sessions,
    k.status,
    k.last_used_at
FROM api_keys k
JOIN organizations o ON k.organization_id = o.id
LEFT JOIN browser_sessions s ON k.id = s.api_key_id
GROUP BY k.id, k.name, o.name, k.status, k.last_used_at
ORDER BY sessions DESC
LIMIT 20;


-- 6.4 Project Activity
SELECT 
    p.name as project,
    o.name as organization,
    COUNT(s.id) as sessions,
    MAX(s.created_at) as last_session
FROM projects p
JOIN organizations o ON p.organization_id = o.id
LEFT JOIN browser_sessions s ON p.id = s.project_id
GROUP BY p.id, p.name, o.name
ORDER BY sessions DESC
LIMIT 20;


-- =============================================================================
-- 7. CUSTOMER HEALTH SCORING
-- =============================================================================

-- 7.1 Customer Health Score
WITH org_metrics AS (
    SELECT 
        o.id,
        o.name,
        o.created_at as signup_date,
        p.name as plan,
        p.monthly_price,
        COUNT(s.id) as total_sessions,
        COUNT(s.id) FILTER (WHERE s.created_at > NOW() - INTERVAL '30 days') as sessions_30d,
        COUNT(s.id) FILTER (WHERE s.created_at > NOW() - INTERVAL '7 days') as sessions_7d,
        MAX(s.created_at) as last_session,
        ROUND(100.0 * COUNT(s.id) FILTER (WHERE s.status = 'completed') / NULLIF(COUNT(s.id), 0), 1) as success_rate
    FROM organizations o
    LEFT JOIN browser_sessions s ON o.id = s.organization_id
    LEFT JOIN subscriptions sub ON o.id = sub.organization_id AND sub.status = 'active'
    LEFT JOIN plans p ON sub.plan_id = p.id
    WHERE o.status = 'active'
    GROUP BY o.id, o.name, o.created_at, p.name, p.monthly_price
)
SELECT 
    name,
    plan,
    monthly_price,
    total_sessions,
    sessions_30d,
    sessions_7d,
    last_session,
    success_rate,
    CASE 
        WHEN sessions_7d >= 50 AND success_rate >= 90 THEN 'Healthy'
        WHEN sessions_7d >= 10 AND success_rate >= 70 THEN 'At Risk'
        WHEN sessions_7d >= 1 THEN 'Needs Attention'
        ELSE 'Churning'
    END as health_status
FROM org_metrics
ORDER BY monthly_price DESC NULLS LAST, sessions_30d DESC;


-- =============================================================================
-- 8. QUICK COUNTS (sanity check)
-- =============================================================================
SELECT 
    'plans' as table_name, COUNT(*) as rows FROM plans
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL SELECT 'api_keys', COUNT(*) FROM api_keys
UNION ALL SELECT 'projects', COUNT(*) FROM projects
UNION ALL SELECT 'browser_sessions', COUNT(*) FROM browser_sessions
UNION ALL SELECT 'session_events', COUNT(*) FROM session_events
UNION ALL SELECT 'usage_records', COUNT(*) FROM usage_records
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices;
