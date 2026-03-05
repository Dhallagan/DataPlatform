{{ config(schema='finance', alias='monthly_revenue', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('monthly_revenue') }}
