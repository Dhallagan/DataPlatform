-- =============================================================================
-- STAGING: GTM Employees
-- =============================================================================
-- Source: bronze_supabase_gtm.employees
-- Grain: 1 row per internal GTM employee
-- =============================================================================

{% set employees_source = source('bronze_supabase_gtm', 'employees') %}
{% if execute %}
    {% set employees_rel = adapter.get_relation(database=employees_source.database, schema=employees_source.schema, identifier=employees_source.identifier) %}
{% else %}
    {% set employees_rel = none %}
{% endif %}

WITH source AS (
    {% if employees_rel is not none %}
        SELECT * FROM {{ employees_source }}
    {% else %}
        SELECT
            NULL::TEXT AS id,
            NULL::TEXT AS employee_email,
            NULL::TEXT AS full_name,
            NULL::TEXT AS role_title,
            NULL::TEXT AS team,
            NULL::TEXT AS manager_employee_id,
            NULL::BOOLEAN AS is_active,
            NULL::TIMESTAMP AS created_at,
            NULL::TIMESTAMP AS updated_at
        WHERE FALSE
    {% endif %}
),

staged AS (
    SELECT
        id::TEXT                            AS employee_id,
        LOWER(TRIM(employee_email))::TEXT   AS employee_email,
        full_name::TEXT                     AS full_name,
        role_title::TEXT                    AS role_title,
        team::TEXT                          AS team,
        manager_employee_id::TEXT           AS manager_employee_id,
        is_active::BOOLEAN                  AS is_active,
        created_at::TIMESTAMP               AS created_at,
        updated_at::TIMESTAMP               AS updated_at,
        CURRENT_TIMESTAMP                   AS _loaded_at
    FROM source
)

SELECT * FROM staged
