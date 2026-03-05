{{ config(schema='finance', alias='ramp_spend_monthly', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('ramp_spend_monthly') }}
