-- =============================================================================
-- METRIC VIEW: Active Organizations
-- =============================================================================
-- Definition: Organizations with at least 1 session in the last 30 days
-- Purpose: Canonical definition of "active organization" for dashboards
-- =============================================================================

WITH org_activity AS (
    SELECT
        organization_id,
        MAX(session_date) AS last_session_date,
        COUNT(*) AS sessions_last_30d
    FROM {{ ref('core_sessions') }}
    WHERE session_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY 1
)

SELECT
    o.organization_id,
    o.organization_name,
    o.organization_slug,
    o.current_plan_name,
    o.current_plan_price_usd,
    o.is_paying_customer,
    o.organization_created_at,
    o.account_age_days,
    
    -- Activity
    a.last_session_date,
    a.sessions_last_30d,
    
    -- Lifetime stats
    o.lifetime_sessions,
    o.lifetime_completed_sessions,
    
    -- Classification
    CASE
        WHEN a.sessions_last_30d >= 100 THEN 'high_activity'
        WHEN a.sessions_last_30d >= 20 THEN 'medium_activity'
        WHEN a.sessions_last_30d >= 1 THEN 'low_activity'
        ELSE 'inactive'
    END AS activity_tier

FROM {{ ref('core_organizations') }} o
INNER JOIN org_activity a ON o.organization_id = a.organization_id
WHERE o.organization_status = 'active'
