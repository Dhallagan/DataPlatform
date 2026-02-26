-- =============================================================================
-- STAGING: Browser Sessions
-- =============================================================================
-- Source: bronze_supabase.browser_sessions
-- Grain: 1 row per browser session
-- Purpose: Clean, type-cast, calculate duration
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase', 'browser_sessions') }}
),

staged AS (
    SELECT
        -- Keys
        id::TEXT                                    AS session_id,
        organization_id::TEXT                       AS organization_id,
        project_id::TEXT                            AS project_id,
        api_key_id::TEXT                            AS api_key_id,
        
        -- Browser Config
        LOWER(TRIM(browser_type))::TEXT             AS browser_type,
        viewport_width::INTEGER                     AS viewport_width,
        viewport_height::INTEGER                    AS viewport_height,
        
        -- Proxy
        LOWER(TRIM(proxy_type))::TEXT               AS proxy_type,
        UPPER(TRIM(proxy_country))::TEXT            AS proxy_country,
        stealth_mode::BOOLEAN                       AS is_stealth_mode,
        
        -- Status
        LOWER(TRIM(status))::TEXT                   AS status,
        
        -- Timing
        started_at::TIMESTAMP_NTZ                   AS started_at,
        ended_at::TIMESTAMP_NTZ                     AS ended_at,
        timeout_at::TIMESTAMP_NTZ                   AS timeout_at,
        
        -- Calculated: session duration in seconds
        CASE 
            WHEN ended_at IS NOT NULL AND started_at IS NOT NULL 
            THEN DATEDIFF('second', started_at, ended_at)
            ELSE NULL
        END                                         AS duration_seconds,
        
        -- Request metadata
        user_agent::TEXT                            AS user_agent,
        initial_url::TEXT                           AS initial_url,
        
        -- Usage metrics
        pages_visited::INTEGER                      AS pages_visited,
        bytes_downloaded::BIGINT                    AS bytes_downloaded,
        bytes_uploaded::BIGINT                      AS bytes_uploaded,
        
        -- Timestamps
        created_at::TIMESTAMP_NTZ                   AS created_at,
        updated_at::TIMESTAMP_NTZ                   AS updated_at,
        
        -- Metadata
        CURRENT_TIMESTAMP()                         AS _loaded_at
        
    FROM source
)

SELECT * FROM staged
