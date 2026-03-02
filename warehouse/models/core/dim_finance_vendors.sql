-- =============================================================================
-- DIMENSION: Finance Vendors
-- =============================================================================

SELECT
    vendor_id,
    organization_id,
    vendor_name,
    category,
    status AS vendor_status,
    payment_terms,
    risk_level,
    country,
    currency,
    created_at,
    updated_at,
    _loaded_at
FROM {{ ref('stg_finance_vendors') }}
