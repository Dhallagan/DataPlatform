{{ config(schema='growth', alias='gtm_unit_economics_monthly', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('gtm_unit_economics_monthly') }}
