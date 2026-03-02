-- =============================================================================
-- DIMENSION: Users
-- =============================================================================
-- Grain: 1 row per user
-- Purpose: Canonical user dimension for metric joins
-- =============================================================================

SELECT
    user_id,
    email,
    full_name,
    user_status,
    auth_provider,
    is_email_verified,
    primary_organization_id AS organization_id,
    primary_organization_role,
    organization_count,
    user_created_at,
    last_login_at,
    account_age_days,
    days_since_last_login,
    _loaded_at
FROM {{ ref('users') }}
