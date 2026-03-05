{{ config(schema='growth', alias='signal_trial_conversion_risk_daily', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('signal_trial_conversion_risk_daily') }}
