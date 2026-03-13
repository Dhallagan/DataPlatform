-- =============================================================================
-- STAGING: Plan Economics
-- =============================================================================
-- Source: bronze_supabase.plan_economics
-- Grain: 1 row per plan economics revision
-- Purpose: Cleaned expected plan cost assumptions with effective windows
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase', 'plan_economics') }}
),

staged AS (
    SELECT
        CAST(id AS TEXT) AS plan_economics_id,
        CAST(plan_id AS TEXT) AS plan_id,
        CAST(expected_cost_per_hour_usd AS DECIMAL(10,4)) AS expected_cost_per_hour_usd,
        CAST(effective_start AS TIMESTAMP) AS effective_start,
        CAST(effective_end AS TIMESTAMP) AS effective_end,
        CAST(notes AS TEXT) AS notes,
        CAST(created_at AS TIMESTAMP) AS created_at,
        CAST(updated_at AS TIMESTAMP) AS updated_at,
        CAST(_synced_at AS TIMESTAMP) AS _synced_at
    FROM source
)

SELECT * FROM staged
