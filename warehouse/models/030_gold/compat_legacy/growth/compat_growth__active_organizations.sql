{{ config(schema='growth', alias='active_organizations', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('active_organizations') }}
