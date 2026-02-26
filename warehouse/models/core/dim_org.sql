-- =============================================================================
-- DIMENSION: Organizations
-- =============================================================================
-- Grain: 1 row per organization
-- Purpose: Canonical organization dimension for metric joins
-- =============================================================================

SELECT
    organization_id,
    organization_name,
    organization_slug,
    organization_status,
    current_plan_id,
    current_plan_name,
    current_plan_price_usd,
    is_paying_customer,
    organization_created_at,
    account_age_days,
    days_since_last_session,
    _loaded_at
FROM {{ ref('core_organizations') }}
