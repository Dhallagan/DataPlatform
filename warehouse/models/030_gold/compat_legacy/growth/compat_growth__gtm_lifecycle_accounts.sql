{{ config(schema='growth', alias='gtm_lifecycle_accounts', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('gtm_lifecycle_accounts') }}
