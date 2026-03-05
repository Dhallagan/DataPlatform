{{ config(schema='product', alias='product_daily', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('product_daily') }}
