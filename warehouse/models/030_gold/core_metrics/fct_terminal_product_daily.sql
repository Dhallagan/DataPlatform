{{ config(alias='product_daily', schema='term') }}

-- =============================================================================
-- FACT VIEW: Product Terminal Daily
-- =============================================================================
-- Grain: 1 row per metric_date
-- Purpose: Unified product + ops reliability trend inputs
-- =============================================================================

WITH product AS (
    SELECT
        metric_date,
        total_sessions,
        success_rate_pct,
        avg_duration_seconds,
        proxy_adoption_pct,
        stealth_adoption_pct
    FROM {{ ref('product_daily') }}
),

ops AS (
    SELECT
        metric_date,
        total_sessions AS ops_total_sessions,
        total_gb_transferred,
        avg_duration_seconds AS ops_avg_duration_seconds,
        proxy_session_pct
    FROM {{ ref('ops_daily') }}
),

eng AS (
    SELECT
        metric_date,
        completed_sessions,
        failed_sessions,
        timeout_sessions,
        success_rate_pct AS eng_success_rate_pct,
        timeout_rate_pct,
        errors_per_1k_sessions
    FROM {{ ref('engineering_daily') }}
),

calendar AS (
    SELECT metric_date FROM product
    UNION
    SELECT metric_date FROM ops
    UNION
    SELECT metric_date FROM eng
)

SELECT
    c.metric_date,
    p.total_sessions,
    p.success_rate_pct,
    p.avg_duration_seconds,
    p.proxy_adoption_pct,
    p.stealth_adoption_pct,
    o.ops_total_sessions,
    o.total_gb_transferred,
    o.ops_avg_duration_seconds,
    o.proxy_session_pct,
    e.completed_sessions,
    e.failed_sessions,
    e.timeout_sessions,
    e.eng_success_rate_pct,
    e.timeout_rate_pct,
    e.errors_per_1k_sessions,
    CURRENT_TIMESTAMP AS _loaded_at
FROM calendar c
LEFT JOIN product p ON c.metric_date = p.metric_date
LEFT JOIN ops o ON c.metric_date = o.metric_date
LEFT JOIN eng e ON c.metric_date = e.metric_date
ORDER BY c.metric_date DESC
