-- =============================================================================
-- STAGING: Invoices
-- =============================================================================
-- Source: bronze_supabase.invoices
-- Grain: 1 row per invoice
-- Purpose: Cleaned and typed invoice records
-- =============================================================================

WITH source AS (
    SELECT
        id,
        organization_id,
        subscription_id,
        stripe_invoice_id,
        subtotal,
        tax,
        total,
        status,
        period_start,
        period_end,
        due_date,
        paid_at,
        created_at,
        _synced_at
    FROM {{ source('bronze_supabase', 'invoices') }}
),

final AS (
    SELECT
        CAST(id AS TEXT) AS invoice_id,
        CAST(organization_id AS TEXT) AS organization_id,
        CAST(subscription_id AS TEXT) AS subscription_id,
        CAST(stripe_invoice_id AS TEXT) AS stripe_invoice_id,
        CAST(subtotal AS INTEGER) AS subtotal_cents,
        CAST(tax AS INTEGER) AS tax_cents,
        CAST(total AS INTEGER) AS total_cents,
        LOWER(TRIM(CAST(status AS TEXT))) AS invoice_status,
        CAST(period_start AS DATE) AS period_start,
        CAST(period_end AS DATE) AS period_end,
        CAST(due_date AS DATE) AS due_date,
        CAST(paid_at AS TIMESTAMP) AS paid_at,
        CAST(created_at AS TIMESTAMP) AS created_at,
        CAST(_synced_at AS TIMESTAMP) AS _synced_at
    FROM source
)

SELECT * FROM final
