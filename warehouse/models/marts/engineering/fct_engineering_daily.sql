-- =============================================================================
-- FACT TABLE: Engineering Daily
-- =============================================================================
-- Grain: 1 row per day
-- Purpose: Reliability and performance KPIs for engineering
-- =============================================================================

WITH sessions AS (
    SELECT * FROM {{ ref('core_sessions') }}
),

daily AS (
    SELECT
        session_date AS metric_date,
        COUNT(*) AS total_sessions,
        COUNT(CASE WHEN session_status = 'completed' THEN 1 END) AS completed_sessions,
        COUNT(CASE WHEN session_status = 'failed' THEN 1 END) AS failed_sessions,
        COUNT(CASE WHEN session_status = 'timeout' THEN 1 END) AS timeout_sessions,
        SUM(error_count) AS total_error_events,
        AVG(duration_seconds) AS avg_duration_seconds,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_seconds) AS p95_duration_seconds,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_seconds) AS p99_duration_seconds
    FROM sessions
    GROUP BY 1
),

final AS (
    SELECT
        metric_date,
        total_sessions,
        completed_sessions,
        failed_sessions,
        timeout_sessions,
        total_error_events,
        ROUND(completed_sessions::DECIMAL / NULLIF(total_sessions, 0) * 100, 2) AS success_rate_pct,
        ROUND(failed_sessions::DECIMAL / NULLIF(total_sessions, 0) * 100, 2) AS failure_rate_pct,
        ROUND(timeout_sessions::DECIMAL / NULLIF(total_sessions, 0) * 100, 2) AS timeout_rate_pct,
        ROUND(total_error_events::DECIMAL / NULLIF(total_sessions, 0) * 1000, 2) AS errors_per_1k_sessions,
        ROUND(avg_duration_seconds, 2) AS avg_duration_seconds,
        ROUND(p95_duration_seconds, 2) AS p95_duration_seconds,
        ROUND(p99_duration_seconds, 2) AS p99_duration_seconds,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM daily
)

SELECT * FROM final
