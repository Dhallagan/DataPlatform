{{ config(schema='ops', alias='ops_daily', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('ops_daily') }}
