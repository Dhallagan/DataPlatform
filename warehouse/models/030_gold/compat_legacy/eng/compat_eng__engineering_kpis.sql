{{ config(schema='eng', alias='engineering_kpis', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('engineering_kpis') }}
