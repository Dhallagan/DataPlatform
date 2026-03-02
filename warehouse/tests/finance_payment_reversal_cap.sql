-- Fail if completed reversals exceed the original payment amount.
WITH reversal_totals AS (
    SELECT
        bill_payment_id,
        SUM(CASE WHEN reversal_status = 'completed' THEN reversal_amount_usd ELSE 0 END) AS completed_reversal_usd
    FROM {{ ref('fct_finance_payment_reversals') }}
    GROUP BY 1
),

payments AS (
    SELECT
        bill_payment_id,
        amount_usd,
        payment_status
    FROM {{ ref('fct_finance_bill_payments') }}
)

SELECT
    p.bill_payment_id,
    p.payment_status,
    p.amount_usd,
    r.completed_reversal_usd
FROM payments p
JOIN reversal_totals r ON p.bill_payment_id = r.bill_payment_id
WHERE COALESCE(r.completed_reversal_usd, 0) > COALESCE(p.amount_usd, 0) + 0.01
