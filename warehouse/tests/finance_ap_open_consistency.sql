-- Fail if AP open in finance_budget_vs_actual_monthly diverges from bill + adjustment logic.
WITH bill_base AS (
    SELECT
        organization_id,
        DATE_TRUNC('month', COALESCE(due_date, bill_date))::DATE AS month,
        SUM(CASE WHEN bill_status IN ('submitted', 'approved', 'scheduled') THEN amount_usd ELSE 0 END) AS ap_base_usd
    FROM {{ ref('fct_finance_bills') }}
    GROUP BY 1, 2
),

adjustments AS (
    SELECT
        organization_id,
        adjusted_month AS month,
        SUM(signed_amount_usd) AS bill_adjustment_net_usd
    FROM {{ ref('fct_finance_bill_adjustments') }}
    GROUP BY 1, 2
),

expected AS (
    SELECT
        COALESCE(b.organization_id, a.organization_id) AS organization_id,
        COALESCE(b.month, a.month) AS month,
        COALESCE(b.ap_base_usd, 0) + COALESCE(a.bill_adjustment_net_usd, 0) AS expected_ap_open_usd
    FROM bill_base b
    FULL OUTER JOIN adjustments a
      ON b.organization_id = a.organization_id
     AND b.month = a.month
),

actual AS (
    SELECT
        organization_id,
        budget_month AS month,
        ap_open_usd
    FROM {{ ref('finance_budget_vs_actual_monthly') }}
)

SELECT
    COALESCE(e.organization_id, a.organization_id) AS organization_id,
    COALESCE(e.month, a.month) AS month,
    COALESCE(e.expected_ap_open_usd, 0) AS expected_ap_open_usd,
    COALESCE(a.ap_open_usd, 0) AS actual_ap_open_usd
FROM expected e
FULL OUTER JOIN actual a
  ON e.organization_id = a.organization_id
 AND e.month = a.month
WHERE ABS(COALESCE(e.expected_ap_open_usd, 0) - COALESCE(a.ap_open_usd, 0)) > 0.01
