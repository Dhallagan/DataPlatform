{{ config(schema='product', alias='product_kpis', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('product_kpis') }}
