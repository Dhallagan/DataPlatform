-- Test: fct_business_snapshot_monthly compound primary key uniqueness
-- Expects 0 rows (no duplicate org+month combos)

SELECT
    organization_id,
    month_start,
    COUNT(*) AS row_count
FROM {{ ref('fct_business_snapshot_monthly') }}
GROUP BY 1, 2
HAVING COUNT(*) > 1
