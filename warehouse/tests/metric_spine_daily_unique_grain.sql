-- Fail duplicate rows for organization x metric_date grain.
SELECT
    metric_date,
    organization_id,
    COUNT(*) AS row_count
FROM {{ ref('metric_spine_daily') }}
GROUP BY 1, 2
HAVING COUNT(*) > 1
