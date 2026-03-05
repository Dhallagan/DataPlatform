{{ config(schema='finance', alias='mrr', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('mrr') }}
