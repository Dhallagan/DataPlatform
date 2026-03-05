{{ config(schema='finance', alias='finance_budget_vs_actual_monthly', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('finance_budget_vs_actual_monthly') }}
