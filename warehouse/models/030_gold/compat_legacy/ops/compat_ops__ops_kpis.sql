{{ config(schema='ops', alias='ops_kpis', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('ops_kpis') }}
