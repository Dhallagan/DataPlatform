-- =============================================================================
-- STAGING: Organizations
-- =============================================================================
-- Source: bronze_supabase.organizations
-- Grain: 1 row per organization
-- Purpose: Clean, type-cast, standardize naming
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase', 'organizations') }}
),

staged AS (
    SELECT
        -- Keys
        id::TEXT                                AS organization_id,
        
        -- Attributes
        name::TEXT                              AS organization_name,
        slug::TEXT                              AS organization_slug,
        
        -- Billing
        stripe_customer_id::TEXT                AS stripe_customer_id,
        billing_email::TEXT                     AS billing_email,
        
        -- Status
        LOWER(TRIM(status))::TEXT               AS status,
        
        -- Timestamps (standardize to UTC)
        created_at::TIMESTAMP_NTZ               AS created_at,
        updated_at::TIMESTAMP_NTZ               AS updated_at,
        
        -- Metadata
        CURRENT_TIMESTAMP()                     AS _loaded_at
        
    FROM source
)

SELECT * FROM staged
