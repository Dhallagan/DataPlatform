-- =============================================================================
-- ANALYTICS: Budget vs Actual (Monthly)
-- =============================================================================
-- Grain: 1 row per organization x month
-- =============================================================================

WITH months AS (
    SELECT DISTINCT month_start AS month
    FROM {{ ref('dim_time') }}
),

orgs AS (
    SELECT DISTINCT organization_id
    FROM {{ ref('dim_organizations') }}
),

budget AS (
    SELECT
        d.organization_id,
        m.month,
        SUM(COALESCE(d.budget_usd, 0)) AS budget_allocated_usd
    FROM {{ ref('dim_finance_departments') }} d
    CROSS JOIN months m
    WHERE d.department_status = 'active'
    GROUP BY 1, 2
),

txn_spend AS (
    SELECT
        organization_id,
        transaction_month AS month,
        SUM(CASE WHEN transaction_status IN ('posted', 'cleared') THEN amount_usd ELSE 0 END) AS card_spend_usd
    FROM {{ ref('fct_finance_transactions') }}
    GROUP BY 1, 2
),

reimburse_spend AS (
    SELECT
        organization_id,
        DATE_TRUNC('month', COALESCE(paid_at, approved_at, submitted_at))::DATE AS month,
        SUM(CASE WHEN reimbursement_status IN ('approved', 'paid') THEN amount_usd ELSE 0 END) AS reimbursement_spend_usd
    FROM {{ ref('fct_finance_reimbursements') }}
    GROUP BY 1, 2
),

bill_payment_spend AS (
    SELECT
        bp.organization_id,
        bp.paid_month AS month,
        (
            SUM(CASE WHEN bp.payment_status = 'paid' THEN bp.amount_usd ELSE 0 END)
            - COALESCE(SUM(CASE WHEN pr.reversal_status = 'completed' THEN pr.reversal_amount_usd ELSE 0 END), 0)
        ) AS bill_payment_spend_usd
    FROM {{ ref('fct_finance_bill_payments') }} bp
    LEFT JOIN {{ ref('fct_finance_payment_reversals') }} pr
      ON bp.bill_payment_id = pr.bill_payment_id
     AND bp.organization_id = pr.organization_id
    GROUP BY 1, 2
),

bill_adjustments AS (
    SELECT
        organization_id,
        adjusted_month AS month,
        SUM(signed_amount_usd) AS bill_adjustment_net_usd
    FROM {{ ref('fct_finance_bill_adjustments') }}
    GROUP BY 1, 2
),

ap_open AS (
    SELECT
        COALESCE(b.organization_id, a.organization_id) AS organization_id,
        COALESCE(b.month, a.month) AS month,
        (COALESCE(b.ap_base_usd, 0) + COALESCE(a.bill_adjustment_net_usd, 0)) AS ap_open_usd
    FROM (
        SELECT
            organization_id,
            DATE_TRUNC('month', COALESCE(due_date, bill_date))::DATE AS month,
            SUM(CASE WHEN bill_status IN ('submitted', 'approved', 'scheduled') THEN amount_usd ELSE 0 END) AS ap_base_usd
        FROM {{ ref('fct_finance_bills') }}
        GROUP BY 1, 2
    ) b
    FULL OUTER JOIN bill_adjustments a
      ON b.organization_id = a.organization_id
     AND b.month = a.month
),

combined AS (
    SELECT
        o.organization_id,
        m.month,
        COALESCE(b.budget_allocated_usd, 0) AS budget_allocated_usd,
        COALESCE(t.card_spend_usd, 0) AS card_spend_usd,
        COALESCE(r.reimbursement_spend_usd, 0) AS reimbursement_spend_usd,
        COALESCE(p.bill_payment_spend_usd, 0) AS bill_payment_spend_usd,
        COALESCE(x.bill_adjustment_net_usd, 0) AS bill_adjustment_net_usd,
        COALESCE(a.ap_open_usd, 0) AS ap_open_usd
    FROM orgs o
    CROSS JOIN months m
    LEFT JOIN budget b ON o.organization_id = b.organization_id AND m.month = b.month
    LEFT JOIN txn_spend t ON o.organization_id = t.organization_id AND m.month = t.month
    LEFT JOIN reimburse_spend r ON o.organization_id = r.organization_id AND m.month = r.month
    LEFT JOIN bill_payment_spend p ON o.organization_id = p.organization_id AND m.month = p.month
    LEFT JOIN bill_adjustments x ON o.organization_id = x.organization_id AND m.month = x.month
    LEFT JOIN ap_open a ON o.organization_id = a.organization_id AND m.month = a.month
)

SELECT
    organization_id,
    month AS budget_month,
    budget_allocated_usd,
    card_spend_usd,
    reimbursement_spend_usd,
    bill_payment_spend_usd,
    bill_adjustment_net_usd,
    (card_spend_usd + reimbursement_spend_usd + bill_payment_spend_usd) AS actual_spend_usd,
    (budget_allocated_usd - (card_spend_usd + reimbursement_spend_usd + bill_payment_spend_usd)) AS budget_variance_usd,
    ROUND(
        (card_spend_usd + reimbursement_spend_usd + bill_payment_spend_usd)
        / NULLIF(budget_allocated_usd, 0),
        4
    ) AS budget_utilization_ratio,
    ap_open_usd,
    CURRENT_TIMESTAMP AS _loaded_at
FROM combined
WHERE month <= DATE_TRUNC('month', CURRENT_DATE)
