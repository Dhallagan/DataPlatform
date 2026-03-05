{{ config(schema='eng', alias='engineering_daily', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('engineering_daily') }}
