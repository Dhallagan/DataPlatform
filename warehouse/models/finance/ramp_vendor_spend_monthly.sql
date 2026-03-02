-- =============================================================================
-- ANALYTICS: Ramp Vendor Spend Monthly
-- =============================================================================

WITH txn AS (
    SELECT
        t.organization_id,
        t.vendor_id,
        t.transaction_month AS spend_month,
        SUM(CASE WHEN t.transaction_status IN ('posted', 'cleared') THEN t.amount_usd ELSE 0 END) AS spend_usd
    FROM {{ ref('fct_finance_transactions') }} t
    GROUP BY 1, 2, 3
),

bill_paid AS (
    SELECT
        bp.organization_id,
        b.vendor_id,
        bp.paid_month AS spend_month,
        SUM(CASE WHEN bp.payment_status = 'paid' THEN bp.amount_usd ELSE 0 END) AS gross_paid_usd
    FROM {{ ref('fct_finance_bill_payments') }} bp
    LEFT JOIN {{ ref('fct_finance_bills') }} b ON bp.bill_id = b.bill_id
    GROUP BY 1, 2, 3
),

bill_reversal_enriched AS (
    SELECT
        r.organization_id,
        COALESCE(r.bill_id, p.bill_id) AS bill_id,
        r.reversed_month AS spend_month,
        SUM(CASE WHEN r.reversal_status = 'completed' THEN r.reversal_amount_usd ELSE 0 END) AS reversed_paid_usd
    FROM {{ ref('fct_finance_payment_reversals') }} r
    LEFT JOIN {{ ref('fct_finance_bill_payments') }} p
      ON r.bill_payment_id = p.bill_payment_id
     AND r.organization_id = p.organization_id
    GROUP BY 1, 2, 3
),

bill_reversal_by_vendor AS (
    SELECT
        r.organization_id,
        b.vendor_id,
        r.spend_month,
        SUM(r.reversed_paid_usd) AS reversed_paid_usd
    FROM bill_reversal_enriched r
    LEFT JOIN {{ ref('fct_finance_bills') }} b ON r.bill_id = b.bill_id
    GROUP BY 1, 2, 3
),

bill_paid_net AS (
    SELECT
        b.organization_id,
        b.vendor_id,
        b.spend_month,
        (b.gross_paid_usd - COALESCE(r.reversed_paid_usd, 0)) AS spend_usd
    FROM bill_paid b
    LEFT JOIN bill_reversal_by_vendor r
      ON b.organization_id = r.organization_id
     AND b.vendor_id = r.vendor_id
     AND b.spend_month = r.spend_month
),

unioned AS (
    SELECT * FROM txn
    UNION ALL
    SELECT * FROM bill_paid_net
),

aggregated AS (
    SELECT
        organization_id,
        vendor_id,
        spend_month,
        SUM(spend_usd) AS total_spend_usd
    FROM unioned
    GROUP BY 1, 2, 3
)

SELECT
    a.organization_id,
    a.vendor_id,
    COALESCE(v.vendor_name, 'unknown_vendor') AS vendor_name,
    a.spend_month,
    a.total_spend_usd,
    CURRENT_TIMESTAMP AS _loaded_at
FROM aggregated a
LEFT JOIN {{ ref('dim_finance_vendors') }} v
  ON a.vendor_id = v.vendor_id
