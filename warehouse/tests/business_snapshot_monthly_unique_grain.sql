-- Ensure monthly snapshot is unique at organization_id x month_start grain
SELECT
    organization_id,
    month_start,
    COUNT(*) AS row_count
FROM {{ ref('fct_business_snapshot_monthly') }}
GROUP BY 1, 2
HAVING COUNT(*) > 1
