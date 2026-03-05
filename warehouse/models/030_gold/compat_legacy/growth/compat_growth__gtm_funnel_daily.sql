{{ config(schema='growth', alias='gtm_funnel_daily', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('gtm_funnel_daily') }}
