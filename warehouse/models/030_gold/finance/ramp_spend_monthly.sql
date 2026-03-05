{{ config(alias='agg_spend_monthly') }}

-- =============================================================================
-- ANALYTICS: Ramp Spend Monthly
-- =============================================================================

WITH card_txn AS (
    SELECT
        organization_id,
        transaction_month AS spend_month,
        'card_transaction'::TEXT AS spend_source,
        SUM(CASE WHEN transaction_status IN ('posted', 'cleared') THEN amount_usd ELSE 0 END) AS spend_usd,
        COUNT(*) AS record_count
    FROM {{ ref('fct_finance_transactions') }}
    GROUP BY 1, 2, 3
),

reimbursements AS (
    SELECT
        organization_id,
        DATE_TRUNC('month', COALESCE(paid_at, approved_at, submitted_at))::DATE AS spend_month,
        'reimbursement'::TEXT AS spend_source,
        SUM(CASE WHEN reimbursement_status IN ('approved', 'paid') THEN amount_usd ELSE 0 END) AS spend_usd,
        COUNT(*) AS record_count
    FROM {{ ref('fct_finance_reimbursements') }}
    GROUP BY 1, 2, 3
),

bill_payments AS (
    SELECT
        organization_id,
        paid_month AS spend_month,
        'bill_payment'::TEXT AS spend_source,
        SUM(CASE WHEN payment_status = 'paid' THEN amount_usd ELSE 0 END) AS gross_paid_usd,
        COUNT(*) AS record_count
    FROM {{ ref('fct_finance_bill_payments') }}
    GROUP BY 1, 2, 3
),

payment_reversals AS (
    SELECT
        organization_id,
        reversed_month AS spend_month,
        SUM(CASE WHEN reversal_status = 'completed' THEN reversal_amount_usd ELSE 0 END) AS reversed_paid_usd
    FROM {{ ref('fct_finance_payment_reversals') }}
    GROUP BY 1, 2
),

bill_payments_net AS (
    SELECT
        b.organization_id,
        b.spend_month,
        b.spend_source,
        (b.gross_paid_usd - COALESCE(r.reversed_paid_usd, 0)) AS spend_usd,
        b.record_count
    FROM bill_payments b
    LEFT JOIN payment_reversals r
      ON b.organization_id = r.organization_id
     AND b.spend_month = r.spend_month
),

unioned AS (
    SELECT * FROM card_txn
    UNION ALL
    SELECT * FROM reimbursements
    UNION ALL
    SELECT * FROM bill_payments_net
)

SELECT
    organization_id,
    spend_month,
    spend_source,
    spend_usd,
    record_count,
    CURRENT_TIMESTAMP AS _loaded_at
FROM unioned
