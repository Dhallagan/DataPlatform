-- =============================================================================
-- CORE ENTITY: Users
-- =============================================================================
-- Source: stg_users + organization_members
-- Grain: 1 row per user (the canonical user entity)
-- Purpose: Single source of truth for user attributes
-- =============================================================================

WITH users AS (
    SELECT * FROM {{ ref('stg_users') }}
),

-- Get primary organization for each user (first joined)
org_memberships AS (
    SELECT
        user_id,
        organization_id,
        role,
        joined_at,
        ROW_NUMBER() OVER (
            PARTITION BY user_id 
            ORDER BY joined_at ASC
        ) AS membership_rank
    FROM {{ source('bronze_supabase', 'organization_members') }}
),

primary_org AS (
    SELECT
        user_id,
        organization_id AS primary_organization_id,
        role AS primary_organization_role
    FROM org_memberships
    WHERE membership_rank = 1
),

-- Count organizations per user
org_counts AS (
    SELECT
        user_id,
        COUNT(DISTINCT organization_id) AS organization_count
    FROM org_memberships
    GROUP BY 1
),

final AS (
    SELECT
        -- Primary Key
        u.user_id,
        
        -- User Attributes
        u.email,
        u.full_name,
        u.avatar_url,
        
        -- Auth
        u.auth_provider,
        u.is_email_verified,
        u.status AS user_status,
        
        -- Primary Organization
        po.primary_organization_id,
        po.primary_organization_role,
        COALESCE(oc.organization_count, 0) AS organization_count,
        
        -- Activity
        u.last_login_at,
        
        -- Lifecycle Timestamps
        u.created_at AS user_created_at,
        
        -- Derived: Account Age
        DATEDIFF('day', u.created_at, CURRENT_TIMESTAMP()) AS account_age_days,
        
        -- Derived: Days Since Last Login
        CASE 
            WHEN u.last_login_at IS NOT NULL 
            THEN DATEDIFF('day', u.last_login_at, CURRENT_TIMESTAMP())
            ELSE NULL
        END AS days_since_last_login,
        
        -- Metadata
        CURRENT_TIMESTAMP() AS _loaded_at
        
    FROM users u
    LEFT JOIN primary_org po ON u.user_id = po.user_id
    LEFT JOIN org_counts oc ON u.user_id = oc.user_id
)

SELECT * FROM final
