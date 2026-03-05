-- =============================================================================
-- STAGING: GTM Activities
-- =============================================================================
-- Source: bronze_supabase_gtm.activities
-- Grain: 1 row per activity event
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_gtm', 'activities') }}
),

staged AS (
    SELECT
        id::TEXT                                AS activity_id,
        account_id::TEXT                        AS account_id,
        contact_id::TEXT                        AS contact_id,
        lead_id::TEXT                           AS lead_id,
        opportunity_id::TEXT                    AS opportunity_id,
        LOWER(TRIM(activity_type))::TEXT        AS activity_type,
        LOWER(TRIM(direction))::TEXT            AS direction,
        subject::TEXT                           AS subject,
        outcome::TEXT                           AS outcome,
        occurred_at::TIMESTAMP                  AS occurred_at,
        {{ source_column_or_null('bronze_supabase_gtm', 'activities', 'owner_employee_id', 'TEXT') }} AS owner_employee_id,
        owner_user_id::TEXT                     AS legacy_owner_user_id,
        created_at::TIMESTAMP                   AS created_at,
        CURRENT_TIMESTAMP                       AS _loaded_at
    FROM source
)

SELECT * FROM staged
