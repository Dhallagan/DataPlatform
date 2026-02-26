-- =============================================================================
-- FACT: Subscriptions
-- =============================================================================
-- Grain: 1 row per subscription
-- Purpose: Canonical subscription/billing fact
-- =============================================================================

SELECT
    subscription_id,
    organization_id,
    plan_id,
    status AS subscription_status,
    is_in_trial,
    trial_ends_at,
    current_period_start,
    current_period_end,
    canceled_at,
    created_at AS subscription_created_at,
    updated_at AS subscription_updated_at,
    _loaded_at
FROM {{ ref('stg_subscriptions') }}
