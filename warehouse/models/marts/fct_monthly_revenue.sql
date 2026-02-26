-- =============================================================================
-- FACT TABLE: Monthly Revenue
-- =============================================================================
-- Source: invoices + organizations
-- Grain: 1 row per organization per month
-- Purpose: Monthly revenue tracking and MRR calculation
-- =============================================================================

WITH invoices AS (
    SELECT
        id AS invoice_id,
        organization_id,
        subscription_id,
        subtotal,
        tax,
        total,
        status,
        period_start,
        period_end,
        paid_at,
        created_at
    FROM {{ source('bronze_supabase', 'invoices') }}
),

organizations AS (
    SELECT 
        organization_id,
        organization_name,
        current_plan_name,
        organization_created_at
    FROM {{ ref('core_organizations') }}
),

monthly_revenue AS (
    SELECT
        -- Dimensions
        i.organization_id,
        DATE_TRUNC('month', i.period_start)::DATE AS revenue_month,
        
        -- Invoice Counts
        COUNT(*) AS invoice_count,
        COUNT(CASE WHEN i.status = 'paid' THEN 1 END) AS paid_invoice_count,
        COUNT(CASE WHEN i.status = 'open' THEN 1 END) AS open_invoice_count,
        COUNT(CASE WHEN i.status = 'void' THEN 1 END) AS void_invoice_count,
        
        -- Revenue (in cents → convert to dollars)
        SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) / 100.0 AS realized_revenue_usd,
        SUM(CASE WHEN i.status = 'open' THEN i.total ELSE 0 END) / 100.0 AS pending_revenue_usd,
        SUM(i.total) / 100.0 AS gross_revenue_usd,
        
        -- Tax
        SUM(CASE WHEN i.status = 'paid' THEN i.tax ELSE 0 END) / 100.0 AS tax_collected_usd,
        
        -- Average Invoice Value
        AVG(i.total) / 100.0 AS avg_invoice_value_usd
        
    FROM invoices i
    GROUP BY 1, 2
)

SELECT
    -- Keys
    mr.organization_id,
    mr.revenue_month,
    
    -- Organization Context
    o.organization_name,
    o.current_plan_name,
    
    -- Invoice Metrics
    mr.invoice_count,
    mr.paid_invoice_count,
    mr.open_invoice_count,
    mr.void_invoice_count,
    
    -- Revenue Metrics
    mr.realized_revenue_usd,
    mr.pending_revenue_usd,
    mr.gross_revenue_usd,
    mr.tax_collected_usd,
    mr.avg_invoice_value_usd,
    
    -- Derived: Collection Rate
    ROUND(
        mr.realized_revenue_usd / NULLIF(mr.gross_revenue_usd, 0) * 100,
        2
    ) AS collection_rate_pct,
    
    -- Metadata
    CURRENT_TIMESTAMP() AS _loaded_at

FROM monthly_revenue mr
LEFT JOIN organizations o ON mr.organization_id = o.organization_id
