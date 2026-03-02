-- =============================================================================
-- DIMENSION: Finance Departments
-- =============================================================================

SELECT
    department_id,
    organization_id,
    department_name,
    cost_center,
    budget_usd,
    owner_user_id,
    status AS department_status,
    created_at,
    updated_at,
    _loaded_at
FROM {{ ref('stg_finance_departments') }}
