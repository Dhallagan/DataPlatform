-- Test: fct_terminal_customer_daily compound primary key uniqueness
-- Expects 0 rows (no duplicate org+date combos)

SELECT
    organization_id,
    metric_date,
    COUNT(*) AS row_count
FROM {{ ref('fct_terminal_customer_daily') }}
GROUP BY 1, 2
HAVING COUNT(*) > 1
