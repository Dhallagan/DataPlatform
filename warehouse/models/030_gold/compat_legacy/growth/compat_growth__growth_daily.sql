{{ config(schema='growth', alias='growth_daily', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('growth_daily') }}
