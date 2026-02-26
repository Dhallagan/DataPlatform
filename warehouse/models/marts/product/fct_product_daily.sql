-- =============================================================================
-- FACT TABLE: Product Daily
-- =============================================================================
-- Grain: 1 row per day
-- Purpose: Product engagement and feature adoption trends
-- =============================================================================

WITH sessions AS (
    SELECT * FROM {{ ref('core_sessions') }}
),

daily AS (
    SELECT
        session_date AS metric_date,
        COUNT(*) AS total_sessions,
        COUNT(CASE WHEN is_successful THEN 1 END) AS successful_sessions,
        COUNT(DISTINCT organization_id) AS active_orgs,
        AVG(duration_seconds) AS avg_duration_seconds,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_seconds) AS median_duration_seconds,
        AVG(pages_visited) AS avg_pages_visited,
        COUNT(CASE WHEN used_proxy THEN 1 END) AS sessions_with_proxy,
        COUNT(CASE WHEN is_stealth_mode THEN 1 END) AS sessions_with_stealth,
        COUNT(DISTINCT initial_domain) AS unique_domains_visited
    FROM sessions
    GROUP BY 1
),

final AS (
    SELECT
        metric_date,
        total_sessions,
        successful_sessions,
        total_sessions - successful_sessions AS failed_sessions,
        ROUND(successful_sessions::DECIMAL / NULLIF(total_sessions, 0) * 100, 2) AS success_rate_pct,
        active_orgs,
        ROUND(avg_duration_seconds, 2) AS avg_duration_seconds,
        ROUND(median_duration_seconds, 2) AS median_duration_seconds,
        ROUND(avg_pages_visited, 2) AS avg_pages_visited,
        sessions_with_proxy,
        sessions_with_stealth,
        ROUND(sessions_with_proxy::DECIMAL / NULLIF(total_sessions, 0) * 100, 2) AS proxy_adoption_pct,
        ROUND(sessions_with_stealth::DECIMAL / NULLIF(total_sessions, 0) * 100, 2) AS stealth_adoption_pct,
        unique_domains_visited,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM daily
)

SELECT * FROM final
