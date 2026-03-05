{{ config(materialized='table') }}

SELECT
    table_schema,
    table_name,
    CONCAT(table_schema, '.', table_name) AS table_key,
    column_name,
    data_type,
    is_nullable = 'YES' AS nullable,
    ordinal_position,
    CASE
        WHEN lower(column_name) IN ('email', 'phone', 'ip_address') THEN 'pii'
        WHEN lower(column_name) LIKE '%token%' THEN 'secret'
        WHEN lower(column_name) LIKE '%password%' THEN 'secret'
        ELSE 'standard'
    END AS sensitivity_class,
    CURRENT_TIMESTAMP AS _catalog_loaded_at
FROM information_schema.columns
WHERE table_schema IN ('bronze_supabase', 'silver', 'core', 'growth', 'product', 'finance', 'eng', 'ops')
ORDER BY table_schema, table_name, ordinal_position
