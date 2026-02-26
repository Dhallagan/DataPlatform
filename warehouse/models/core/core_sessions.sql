-- =============================================================================
-- CORE ENTITY: Browser Sessions
-- =============================================================================
-- Source: stg_browser_sessions
-- Grain: 1 row per session (the canonical session entity)
-- Purpose: Single source of truth for session attributes + derived metrics
-- =============================================================================

WITH sessions AS (
    SELECT * FROM {{ ref('stg_browser_sessions') }}
),

-- Count events per session
event_counts AS (
    SELECT
        session_id::TEXT as session_id,
        COUNT(*) AS event_count,
        COUNT(CASE WHEN event_type = 'navigation' THEN 1 END) AS navigation_count,
        COUNT(CASE WHEN event_type = 'click' THEN 1 END) AS click_count,
        COUNT(CASE WHEN event_type = 'error' THEN 1 END) AS error_count
    FROM {{ source('bronze_supabase', 'session_events') }}
    GROUP BY 1
),

final AS (
    SELECT
        -- Primary Key
        s.session_id,
        
        -- Foreign Keys
        s.organization_id,
        s.project_id,
        s.api_key_id,
        
        -- Session Config
        s.browser_type,
        s.viewport_width,
        s.viewport_height,
        CONCAT(s.viewport_width, 'x', s.viewport_height) AS viewport_size,
        
        -- Proxy
        s.proxy_type,
        s.proxy_country,
        s.is_stealth_mode,
        CASE WHEN s.proxy_type IS NOT NULL THEN TRUE ELSE FALSE END AS used_proxy,
        
        -- Status
        s.status AS session_status,
        CASE 
            WHEN s.status = 'completed' THEN TRUE 
            ELSE FALSE 
        END AS is_successful,
        
        -- Timing
        s.started_at,
        s.ended_at,
        s.timeout_at,
        s.duration_seconds,
        
        -- Duration Buckets (useful for analysis)
        CASE
            WHEN s.duration_seconds IS NULL THEN 'unknown'
            WHEN s.duration_seconds < 60 THEN 'under_1_min'
            WHEN s.duration_seconds < 300 THEN '1_to_5_mins'
            WHEN s.duration_seconds < 900 THEN '5_to_15_mins'
            WHEN s.duration_seconds < 1800 THEN '15_to_30_mins'
            ELSE 'over_30_mins'
        END AS duration_bucket,
        
        -- Request metadata
        s.user_agent,
        s.initial_url,
        
        -- Extract domain from initial URL
        SPLIT_PART(SPLIT_PART(s.initial_url, '://', 2), '/', 1) AS initial_domain,
        
        -- Usage Metrics
        s.pages_visited,
        s.bytes_downloaded,
        s.bytes_uploaded,
        s.bytes_downloaded + s.bytes_uploaded AS total_bytes_transferred,
        
        -- Event Metrics (from join)
        COALESCE(e.event_count, 0) AS event_count,
        COALESCE(e.navigation_count, 0) AS navigation_count,
        COALESCE(e.click_count, 0) AS click_count,
        COALESCE(e.error_count, 0) AS error_count,
        
        -- Date dimensions (for easy joining)
        DATE(s.created_at) AS session_date,
        DATE_TRUNC('week', s.created_at)::DATE AS session_week,
        DATE_TRUNC('month', s.created_at)::DATE AS session_month,
        
        -- Timestamps
        s.created_at,
        
        -- Metadata
        CURRENT_TIMESTAMP AS _loaded_at
        
    FROM sessions s
    LEFT JOIN event_counts e ON s.session_id = e.session_id
)

SELECT * FROM final
