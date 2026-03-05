-- Fail rows where certified metric registry entries violate contract expectations.
SELECT
    metric_name,
    certified,
    business_definition,
    sql_definition_or_model,
    grain,
    owner,
    freshness_sla,
    quality_tests,
    version,
    effective_date
FROM {{ ref('metric_registry') }}
WHERE certified IS DISTINCT FROM TRUE
   OR business_definition IS NULL
   OR TRIM(business_definition) = ''
   OR sql_definition_or_model IS NULL
   OR TRIM(sql_definition_or_model) = ''
   OR grain NOT IN ('day', 'week', 'month', 'quarter', 'year')
   OR owner IS NULL
   OR TRIM(owner) = ''
   OR freshness_sla IS NULL
   OR TRIM(freshness_sla) = ''
   OR version IS NULL
   OR TRIM(version) = ''
   OR effective_date IS NULL
