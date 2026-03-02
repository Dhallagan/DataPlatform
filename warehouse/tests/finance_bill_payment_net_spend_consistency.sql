-- Fail if bill_payment monthly spend in ramp_spend_monthly diverges from net paid math.
WITH payment_base AS (
    SELECT
        bp.organization_id,
        bp.paid_month AS spend_month,
        SUM(CASE WHEN bp.payment_status = 'paid' THEN bp.amount_usd ELSE 0 END) AS gross_paid_usd
    FROM {{ ref('fct_finance_bill_payments') }} bp
    GROUP BY 1, 2
),

reversal_base AS (
    SELECT
        organization_id,
        reversed_month AS spend_month,
        SUM(CASE WHEN reversal_status = 'completed' THEN reversal_amount_usd ELSE 0 END) AS reversed_paid_usd
    FROM {{ ref('fct_finance_payment_reversals') }}
    GROUP BY 1, 2
),

expected AS (
    SELECT
        p.organization_id,
        p.spend_month,
        p.gross_paid_usd - COALESCE(r.reversed_paid_usd, 0) AS expected_net_bill_payment_spend_usd
    FROM payment_base p
    LEFT JOIN reversal_base r
      ON p.organization_id = r.organization_id
     AND p.spend_month = r.spend_month
),

actual AS (
    SELECT
        organization_id,
        spend_month,
        spend_usd AS actual_net_bill_payment_spend_usd
    FROM {{ ref('ramp_spend_monthly') }}
    WHERE spend_source = 'bill_payment'
)

SELECT
    COALESCE(e.organization_id, a.organization_id) AS organization_id,
    COALESCE(e.spend_month, a.spend_month) AS spend_month,
    COALESCE(e.expected_net_bill_payment_spend_usd, 0) AS expected_net_bill_payment_spend_usd,
    COALESCE(a.actual_net_bill_payment_spend_usd, 0) AS actual_net_bill_payment_spend_usd
FROM expected e
FULL OUTER JOIN actual a
  ON e.organization_id = a.organization_id
 AND e.spend_month = a.spend_month
WHERE ABS(
    COALESCE(e.expected_net_bill_payment_spend_usd, 0)
    - COALESCE(a.actual_net_bill_payment_spend_usd, 0)
) > 0.01
