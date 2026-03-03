{{ config(materialized='table') }}

SELECT
    child_unique_id,
    child_object,
    child_resource_type,
    parent_unique_id,
    parent_object,
    parent_resource_type,
    generated_at::TIMESTAMP AS generated_at,
    CURRENT_TIMESTAMP AS _catalog_loaded_at
FROM {{ ref('metadata_lineage_catalog') }}
