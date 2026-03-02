-- =============================================================================
-- DIMENSION: Finance Cards
-- =============================================================================

SELECT
    card_id,
    organization_id,
    card_last4,
    card_brand,
    card_type,
    cardholder_user_id,
    department_id,
    vendor_id,
    spend_limit_usd,
    status AS card_status,
    issued_at,
    frozen_at,
    created_at,
    updated_at,
    _loaded_at
FROM {{ ref('stg_finance_cards') }}
