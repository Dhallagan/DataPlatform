-- =============================================================================
-- STAGING: Usage Records
-- =============================================================================
-- Source: bronze_supabase.usage_records
-- Grain: 1 row per organization per billing period
-- Purpose: Cleaned and typed billing-period usage ledger
-- =============================================================================

WITH source AS (
    SELECT
        id,
        organization_id,
        subscription_id,
        period_start,
        period_end,
        sessions_count,
        session_minutes,
        bytes_downloaded,
        bytes_uploaded,
        proxy_requests,
        created_at,
        updated_at,
        _synced_at
    FROM {{ source('bronze_supabase', 'usage_records') }}
),

final AS (
    SELECT
        CAST(id AS TEXT) AS usage_record_id,
        CAST(organization_id AS TEXT) AS organization_id,
        CAST(subscription_id AS TEXT) AS subscription_id,
        CAST(period_start AS DATE) AS period_start,
        CAST(period_end AS DATE) AS period_end,
        CAST(sessions_count AS INTEGER) AS sessions_count,
        CAST(session_minutes AS DECIMAL(12,2)) AS session_minutes,
        CAST(bytes_downloaded AS BIGINT) AS bytes_downloaded,
        CAST(bytes_uploaded AS BIGINT) AS bytes_uploaded,
        CAST(proxy_requests AS INTEGER) AS proxy_requests,
        CAST(created_at AS TIMESTAMP) AS created_at,
        CAST(updated_at AS TIMESTAMP) AS updated_at,
        CAST(_synced_at AS TIMESTAMP) AS _synced_at
    FROM source
)

SELECT * FROM final
