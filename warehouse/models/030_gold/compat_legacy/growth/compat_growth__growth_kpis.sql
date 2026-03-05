{{ config(schema='growth', alias='growth_kpis', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('growth_kpis') }}
