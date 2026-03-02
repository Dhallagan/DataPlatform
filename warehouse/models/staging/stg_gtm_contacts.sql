-- =============================================================================
-- STAGING: GTM Contacts
-- =============================================================================
-- Source: bronze_supabase_gtm.contacts
-- Grain: 1 row per contact
-- =============================================================================

WITH source AS (
    SELECT * FROM {{ source('bronze_supabase_gtm', 'contacts') }}
),

staged AS (
    SELECT
        id::TEXT                                AS contact_id,
        account_id::TEXT                        AS account_id,
        LOWER(TRIM(email))::TEXT                AS email,
        full_name::TEXT                         AS full_name,
        title::TEXT                             AS title,
        department::TEXT                        AS department,
        seniority::TEXT                         AS seniority,
        LOWER(TRIM(lifecycle_stage))::TEXT      AS lifecycle_stage,
        is_primary_contact::BOOLEAN             AS is_primary_contact,
        created_at::TIMESTAMP                   AS created_at,
        updated_at::TIMESTAMP                   AS updated_at,
        CURRENT_TIMESTAMP                       AS _loaded_at
    FROM source
)

SELECT * FROM staged
