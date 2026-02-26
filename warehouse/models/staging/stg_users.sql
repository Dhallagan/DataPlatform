-- =============================================================================
-- STAGING: Users
-- =============================================================================
-- Source: bronze_supabase.users
-- Grain: 1 row per user
-- Purpose: Clean, type-cast, standardize naming
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase', 'users') }}
),

staged AS (
    SELECT
        -- Keys
        id::TEXT                                AS user_id,
        
        -- Attributes
        email::TEXT                             AS email,
        full_name::TEXT                         AS full_name,
        avatar_url::TEXT                        AS avatar_url,
        
        -- Auth
        LOWER(TRIM(auth_provider))::TEXT        AS auth_provider,
        email_verified::BOOLEAN                 AS is_email_verified,
        
        -- Status
        LOWER(TRIM(status))::TEXT               AS status,
        
        -- Timestamps
        created_at::TIMESTAMP_NTZ               AS created_at,
        updated_at::TIMESTAMP_NTZ               AS updated_at,
        last_login_at::TIMESTAMP_NTZ            AS last_login_at,
        
        -- Metadata
        CURRENT_TIMESTAMP()                     AS _loaded_at
        
    FROM source
)

SELECT * FROM staged
