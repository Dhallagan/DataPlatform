-- =============================================================================
-- METRIC VIEW: Daily KPIs
-- =============================================================================
-- Definition: Key platform metrics aggregated daily
-- Purpose: Single source for daily business health dashboard
-- =============================================================================

WITH daily_sessions AS (
    SELECT
        session_date,
        COUNT(*) AS total_sessions,
        COUNT(DISTINCT organization_id) AS active_orgs,
        COUNT(CASE WHEN is_successful THEN 1 END) AS successful_sessions,
        SUM(duration_seconds) AS total_duration_seconds,
        SUM(total_bytes_transferred) AS total_bytes,
        SUM(pages_visited) AS total_pages
    FROM {{ ref('sessions') }}
    GROUP BY 1
),

daily_new_orgs AS (
    SELECT
        DATE(organization_created_at) AS signup_date,
        COUNT(*) AS new_organizations
    FROM {{ ref('organizations') }}
    GROUP BY 1
),

daily_new_users AS (
    SELECT
        DATE(user_created_at) AS signup_date,
        COUNT(*) AS new_users
    FROM {{ ref('users') }}
    GROUP BY 1
)

SELECT
    -- Date
    ds.session_date AS date,
    
    -- Session Metrics
    ds.total_sessions,
    ds.successful_sessions,
    ds.total_sessions - ds.successful_sessions AS failed_sessions,
    ROUND(ds.successful_sessions::DECIMAL / NULLIF(ds.total_sessions, 0) * 100, 2) AS success_rate_pct,
    
    -- Activity Metrics
    ds.active_orgs AS daily_active_organizations,
    ds.total_pages AS pages_visited,
    ROUND(ds.total_duration_seconds / 60.0, 2) AS total_session_minutes,
    ROUND(ds.total_bytes / 1024.0 / 1024.0 / 1024.0, 2) AS total_gb_transferred,
    
    -- Growth Metrics
    COALESCE(no.new_organizations, 0) AS new_organizations,
    COALESCE(nu.new_users, 0) AS new_users,
    
    -- Per-Session Averages
    ROUND(ds.total_duration_seconds::DECIMAL / NULLIF(ds.total_sessions, 0), 2) AS avg_session_duration_seconds,
    ROUND(ds.total_pages::DECIMAL / NULLIF(ds.total_sessions, 0), 2) AS avg_pages_per_session,
    
    -- Metadata
    CURRENT_TIMESTAMP AS _calculated_at

FROM daily_sessions ds
LEFT JOIN daily_new_orgs no ON ds.session_date = no.signup_date
LEFT JOIN daily_new_users nu ON ds.session_date = nu.signup_date
ORDER BY ds.session_date DESC
