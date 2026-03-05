{{ config(alias='agg_ops_daily') }}

-- =============================================================================
-- FACT TABLE: Ops Daily
-- =============================================================================
-- Grain: 1 row per day
-- Purpose: Capacity and operational utilization trends
-- =============================================================================

WITH sessions AS (
    SELECT * FROM {{ ref('sessions') }}
),

organizations AS (
    SELECT * FROM {{ ref('organizations') }}
),

api_keys AS (
    SELECT * FROM {{ source('bronze_supabase', 'api_keys') }}
),

daily_sessions AS (
    SELECT
        session_date AS metric_date,
        COUNT(*) AS total_sessions,
        COUNT(DISTINCT organization_id) AS active_organizations,
        SUM(total_bytes_transferred) AS total_bytes_transferred,
        SUM(duration_seconds) AS total_duration_seconds,
        AVG(duration_seconds) AS avg_duration_seconds,
        COUNT(CASE WHEN used_proxy THEN 1 END) AS proxy_sessions,
        COUNT(CASE WHEN is_stealth_mode THEN 1 END) AS stealth_sessions
    FROM sessions
    GROUP BY 1
),

org_context AS (
    SELECT
        DATE(organization_created_at) AS metric_date,
        COUNT(*) AS orgs_created
    FROM organizations
    GROUP BY 1
),

api_key_stats AS (
    SELECT
        DATE(created_at) AS metric_date,
        COUNT(*) AS api_keys_created,
        COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_api_keys_created
    FROM api_keys
    GROUP BY 1
),

final AS (
    SELECT
        ds.metric_date,
        ds.total_sessions,
        ds.active_organizations,
        ROUND(ds.total_bytes_transferred / 1024.0 / 1024.0 / 1024.0, 3) AS total_gb_transferred,
        ROUND(ds.total_duration_seconds / 3600.0, 2) AS total_session_hours,
        ROUND(ds.avg_duration_seconds, 2) AS avg_duration_seconds,
        ds.proxy_sessions,
        ds.stealth_sessions,
        ROUND(ds.proxy_sessions::DECIMAL / NULLIF(ds.total_sessions, 0) * 100, 2) AS proxy_session_pct,
        ROUND(ds.stealth_sessions::DECIMAL / NULLIF(ds.total_sessions, 0) * 100, 2) AS stealth_session_pct,
        COALESCE(oc.orgs_created, 0) AS orgs_created,
        COALESCE(ak.api_keys_created, 0) AS api_keys_created,
        COALESCE(ak.active_api_keys_created, 0) AS active_api_keys_created,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM daily_sessions ds
    LEFT JOIN org_context oc ON ds.metric_date = oc.metric_date
    LEFT JOIN api_key_stats ak ON ds.metric_date = ak.metric_date
)

SELECT * FROM final
