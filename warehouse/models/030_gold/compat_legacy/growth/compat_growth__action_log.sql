{{ config(schema='growth', alias='action_log', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('action_log') }}
