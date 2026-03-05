{{ config(alias='dim_organizations') }}

-- =============================================================================
-- CORE ENTITY: Organizations
-- =============================================================================
-- Source: stg_organizations + stg_subscriptions + stg_plans
-- Grain: 1 row per organization (the canonical organization entity)
-- Purpose: Pure dimension — organization attributes, subscription, and plan context
-- =============================================================================

WITH organizations AS (
    SELECT
        organization_id,
        organization_name,
        organization_slug,
        status,
        stripe_customer_id,
        billing_email,
        created_at
    FROM {{ ref('stg_organizations') }}
),

subscriptions AS (
    SELECT * FROM (
        SELECT
            organization_id,
            subscription_id,
            status,
            plan_id,
            created_at,
            trial_ends_at,
            current_period_start,
            current_period_end,
            ROW_NUMBER() OVER (
                PARTITION BY organization_id
                ORDER BY created_at DESC
            ) as rn
        FROM {{ ref('stg_subscriptions') }}
        WHERE status = 'active'
    ) ranked
    WHERE rn = 1
),

plans AS (
    SELECT
        plan_id,
        plan_name,
        monthly_price_usd,
        sessions_limit_monthly,
        concurrent_sessions_limit,
        max_session_duration_mins,
        has_stealth_mode,
        has_residential_proxies,
        has_priority_support
    FROM {{ ref('stg_plans') }}
),

final AS (
    SELECT
        -- Primary Key
        o.organization_id,

        -- Organization Attributes
        o.organization_name,
        o.organization_slug,
        o.status AS organization_status,

        -- Billing
        o.stripe_customer_id,
        o.billing_email,

        -- Current Subscription
        s.subscription_id AS current_subscription_id,
        s.status AS subscription_status,
        p.plan_id AS current_plan_id,
        p.plan_name AS current_plan_name,
        p.monthly_price_usd AS current_plan_price_usd,

        -- Plan Limits
        p.sessions_limit_monthly,
        p.concurrent_sessions_limit,
        p.max_session_duration_mins,

        -- Plan Features
        p.has_stealth_mode AS plan_has_stealth_mode,
        p.has_residential_proxies AS plan_has_residential_proxies,
        p.has_priority_support AS plan_has_priority_support,

        -- Lifecycle Timestamps
        o.created_at AS organization_created_at,
        s.created_at AS subscription_started_at,
        s.trial_ends_at,
        s.current_period_start,
        s.current_period_end,

        -- Derived: Account Age
        EXTRACT(DAY FROM (CURRENT_TIMESTAMP - o.created_at))::INTEGER AS account_age_days,

        -- Derived: Is Paying Customer
        CASE
            WHEN p.plan_name = 'free' THEN FALSE
            WHEN p.plan_name IS NULL THEN FALSE
            ELSE TRUE
        END AS is_paying_customer,

        -- Metadata
        CURRENT_TIMESTAMP AS _loaded_at

    FROM organizations o
    LEFT JOIN subscriptions s ON o.organization_id = s.organization_id
    LEFT JOIN plans p ON s.plan_id = p.plan_id
)

SELECT * FROM final
