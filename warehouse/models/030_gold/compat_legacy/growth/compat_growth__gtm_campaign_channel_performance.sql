{{ config(schema='growth', alias='gtm_campaign_channel_performance', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('gtm_campaign_channel_performance') }}
