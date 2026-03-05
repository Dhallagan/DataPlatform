{{ config(schema='product', alias='daily_sessions', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('daily_sessions') }}
