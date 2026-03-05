{{ config(schema='growth', alias='growth_task_queue', materialized='view', tags=['compat','legacy-schema']) }}

SELECT *
FROM {{ ref('growth_task_queue') }}
