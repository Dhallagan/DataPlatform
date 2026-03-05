-- Test: metric_spine compound primary key uniqueness
-- Expects 0 rows (no duplicate org+date combos)

SELECT
    organization_id,
    metric_date,
    COUNT(*) AS row_count
FROM {{ ref('metric_spine') }}
GROUP BY 1, 2
HAVING COUNT(*) > 1
