-- =============================================================================
-- STAGING: Plans
-- =============================================================================
-- Source: bronze_supabase.plans
-- Grain: 1 row per plan
-- Purpose: Clean, type-cast
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase', 'plans') }}
),

staged AS (
    SELECT
        -- Keys
        id::TEXT                                    AS plan_id,
        
        -- Attributes
        name::TEXT                                  AS plan_name,
        display_name::TEXT                          AS plan_display_name,
        monthly_price::DECIMAL(10,2)                AS monthly_price_usd,
        
        -- Limits
        sessions_per_month::INTEGER                 AS sessions_limit_monthly,
        concurrent_sessions::INTEGER                AS concurrent_sessions_limit,
        session_duration_mins::INTEGER              AS max_session_duration_mins,
        
        -- Features
        has_stealth_mode::BOOLEAN                   AS has_stealth_mode,
        has_residential_proxies::BOOLEAN            AS has_residential_proxies,
        has_priority_support::BOOLEAN               AS has_priority_support,
        
        -- Timestamps
        created_at::TIMESTAMP                   AS created_at,
        updated_at::TIMESTAMP                   AS updated_at,
        
        -- Metadata
        CURRENT_TIMESTAMP                         AS _loaded_at
        
    FROM source
)

SELECT * FROM staged
