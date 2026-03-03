{{ config(materialized='table') }}

WITH ranked_freshness AS (
    SELECT
        table_schema,
        table_name,
        column_name,
        CASE
            WHEN column_name = '_loaded_at' THEN 1
            WHEN column_name = '_calculated_at' THEN 2
            WHEN column_name = 'triggered_at' THEN 3
            WHEN column_name = '_synced_at' THEN 4
            WHEN column_name = 'metric_date' THEN 5
            WHEN column_name = 'as_of_date' THEN 6
            WHEN column_name = 'date' THEN 7
            ELSE 99
        END AS freshness_priority
    FROM information_schema.columns
    WHERE table_schema IN ('bronze_supabase', 'silver', 'core', 'growth', 'product', 'finance', 'eng', 'ops')
      AND column_name IN ('_loaded_at', '_calculated_at', 'triggered_at', '_synced_at', 'metric_date', 'as_of_date', 'date')
),
freshness_column AS (
    SELECT
        table_schema,
        table_name,
        column_name AS freshness_column
    FROM ranked_freshness
    QUALIFY ROW_NUMBER() OVER (
        PARTITION BY table_schema, table_name
        ORDER BY freshness_priority
    ) = 1
),
table_columns AS (
    SELECT
        table_schema,
        table_name,
        COUNT(*) AS column_count
    FROM information_schema.columns
    WHERE table_schema IN ('bronze_supabase', 'silver', 'core', 'growth', 'product', 'finance', 'eng', 'ops')
    GROUP BY 1, 2
)
SELECT
    t.table_schema,
    t.table_name,
    CONCAT(t.table_schema, '.', t.table_name) AS table_key,
    t.table_type,
    c.column_count,
    f.freshness_column,
    CASE
        WHEN t.table_schema = 'core' THEN 'Data Platform'
        WHEN t.table_schema = 'growth' THEN 'Growth Analytics'
        WHEN t.table_schema = 'product' THEN 'Product Analytics'
        WHEN t.table_schema = 'finance' THEN 'Finance Analytics'
        WHEN t.table_schema = 'eng' THEN 'Engineering Analytics'
        WHEN t.table_schema = 'ops' THEN 'Ops Analytics'
        WHEN t.table_schema = 'silver' THEN 'Analytics Engineering'
        ELSE 'Data Platform'
    END AS owner,
    CASE
        WHEN t.table_schema = 'core' THEN TRUE
        WHEN t.table_name LIKE '%kpi%' THEN TRUE
        WHEN t.table_name LIKE '%metric%' THEN TRUE
        ELSE FALSE
    END AS certified,
    CURRENT_TIMESTAMP AS _catalog_loaded_at
FROM information_schema.tables t
JOIN table_columns c
  ON t.table_schema = c.table_schema
 AND t.table_name = c.table_name
LEFT JOIN freshness_column f
  ON t.table_schema = f.table_schema
 AND t.table_name = f.table_name
WHERE t.table_schema IN ('bronze_supabase', 'silver', 'core', 'growth', 'product', 'finance', 'eng', 'ops')
ORDER BY t.table_schema, t.table_name
