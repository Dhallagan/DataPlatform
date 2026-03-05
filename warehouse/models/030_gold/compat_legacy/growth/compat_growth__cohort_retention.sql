{{ config(schema='growth', alias='cohort_retention', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('cohort_retention') }}
