{{ config(schema='growth', alias='gtm_pipeline_snapshot', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('gtm_pipeline_snapshot') }}
