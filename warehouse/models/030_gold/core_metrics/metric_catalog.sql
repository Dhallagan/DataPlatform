{{ config(materialized='table') }}

SELECT
    metric_name,
    metric_name AS metric_key,
    certified,
    business_definition,
    sql_definition_or_model,
    grain,
    owner,
    freshness_sla,
    quality_tests,
    version,
    effective_date,
    CURRENT_TIMESTAMP AS _catalog_loaded_at
FROM {{ ref('metric_registry') }}
ORDER BY metric_name
