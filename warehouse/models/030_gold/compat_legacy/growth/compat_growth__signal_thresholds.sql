{{ config(schema='growth', alias='signal_thresholds', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('signal_thresholds') }}
