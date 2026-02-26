-- =============================================================================
-- FACT TABLE: Daily Sessions
-- =============================================================================
-- Source: core_sessions + core_organizations
-- Grain: 1 row per organization per day
-- Purpose: Daily aggregates for session activity
-- =============================================================================

WITH sessions AS (
    SELECT * FROM {{ ref('core_sessions') }}
),

organizations AS (
    SELECT 
        organization_id,
        current_plan_name
    FROM {{ ref('core_organizations') }}
),

daily_agg AS (
    SELECT
        -- Dimensions
        s.organization_id,
        s.session_date,
        
        -- Session Counts
        COUNT(*) AS total_sessions,
        COUNT(CASE WHEN s.is_successful THEN 1 END) AS successful_sessions,
        COUNT(CASE WHEN s.session_status = 'failed' THEN 1 END) AS failed_sessions,
        COUNT(CASE WHEN s.session_status = 'timeout' THEN 1 END) AS timeout_sessions,
        
        -- Success Rate
        ROUND(
            COUNT(CASE WHEN s.is_successful THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(*), 0) * 100, 
            2
        ) AS success_rate_pct,
        
        -- Duration Metrics
        SUM(s.duration_seconds) AS total_duration_seconds,
        AVG(s.duration_seconds) AS avg_duration_seconds,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.duration_seconds) AS median_duration_seconds,
        MAX(s.duration_seconds) AS max_duration_seconds,
        
        -- Usage Metrics
        SUM(s.pages_visited) AS total_pages_visited,
        SUM(s.bytes_downloaded) AS total_bytes_downloaded,
        SUM(s.bytes_uploaded) AS total_bytes_uploaded,
        SUM(s.total_bytes_transferred) AS total_bytes_transferred,
        
        -- Event Metrics
        SUM(s.event_count) AS total_events,
        SUM(s.error_count) AS total_errors,
        
        -- Feature Usage
        COUNT(CASE WHEN s.used_proxy THEN 1 END) AS sessions_with_proxy,
        COUNT(CASE WHEN s.is_stealth_mode THEN 1 END) AS sessions_with_stealth,
        
        -- Browser Distribution
        COUNT(CASE WHEN s.browser_type = 'chromium' THEN 1 END) AS chromium_sessions,
        COUNT(CASE WHEN s.browser_type = 'firefox' THEN 1 END) AS firefox_sessions,
        COUNT(CASE WHEN s.browser_type = 'webkit' THEN 1 END) AS webkit_sessions,
        
        -- Unique Domains
        COUNT(DISTINCT s.initial_domain) AS unique_domains_visited
        
    FROM sessions s
    GROUP BY 1, 2
)

SELECT
    -- Keys
    d.organization_id,
    d.session_date,
    
    -- Organization Context
    o.current_plan_name,
    
    -- All metrics from aggregation
    d.total_sessions,
    d.successful_sessions,
    d.failed_sessions,
    d.timeout_sessions,
    d.success_rate_pct,
    d.total_duration_seconds,
    d.avg_duration_seconds,
    d.median_duration_seconds,
    d.max_duration_seconds,
    d.total_pages_visited,
    d.total_bytes_downloaded,
    d.total_bytes_uploaded,
    d.total_bytes_transferred,
    d.total_events,
    d.total_errors,
    d.sessions_with_proxy,
    d.sessions_with_stealth,
    d.chromium_sessions,
    d.firefox_sessions,
    d.webkit_sessions,
    d.unique_domains_visited,
    
    -- Metadata
    CURRENT_TIMESTAMP AS _loaded_at

FROM daily_agg d
LEFT JOIN organizations o ON d.organization_id = o.organization_id
