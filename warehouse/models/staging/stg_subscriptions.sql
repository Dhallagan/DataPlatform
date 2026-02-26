-- =============================================================================
-- STAGING: Subscriptions
-- =============================================================================
-- Source: bronze_supabase.subscriptions
-- Grain: 1 row per subscription
-- Purpose: Clean, type-cast, standardize status
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase', 'subscriptions') }}
),

staged AS (
    SELECT
        -- Keys
        id::TEXT                                    AS subscription_id,
        organization_id::TEXT                       AS organization_id,
        plan_id::TEXT                               AS plan_id,
        
        -- Status
        LOWER(TRIM(status))::TEXT                   AS status,
        
        -- External IDs
        stripe_subscription_id::TEXT                AS stripe_subscription_id,
        
        -- Dates
        trial_ends_at::TIMESTAMP_NTZ                AS trial_ends_at,
        current_period_start::TIMESTAMP_NTZ         AS current_period_start,
        current_period_end::TIMESTAMP_NTZ           AS current_period_end,
        canceled_at::TIMESTAMP_NTZ                  AS canceled_at,
        
        -- Derived: is currently in trial
        CASE 
            WHEN trial_ends_at IS NOT NULL AND trial_ends_at > CURRENT_TIMESTAMP()
            THEN TRUE
            ELSE FALSE
        END                                         AS is_in_trial,
        
        -- Timestamps
        created_at::TIMESTAMP_NTZ                   AS created_at,
        updated_at::TIMESTAMP_NTZ                   AS updated_at,
        
        -- Metadata
        CURRENT_TIMESTAMP()                         AS _loaded_at
        
    FROM source
)

SELECT * FROM staged
