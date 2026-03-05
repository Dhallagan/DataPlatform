-- =============================================================================
-- STAGING: Finance Departments
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_finance', 'departments') }}
),

staged AS (
    SELECT
        id::TEXT                        AS department_id,
        organization_id::TEXT           AS organization_id,
        name::TEXT                      AS department_name,
        cost_center::TEXT               AS cost_center,
        budget_usd::DECIMAL(12,2)       AS budget_usd,
        owner_user_id::TEXT             AS owner_user_id,
        LOWER(TRIM(status))::TEXT       AS status,
        created_at::TIMESTAMP           AS created_at,
        updated_at::TIMESTAMP           AS updated_at,
        CURRENT_TIMESTAMP               AS _loaded_at
    FROM source
)

SELECT * FROM staged
