{{ config(materialized='table') }}

-- Canonical business metric registry used by humans and LLM workflows.
-- One row per metric definition version.

SELECT
    'total_sessions' AS metric_name,
    TRUE AS certified,
    'Daily count of browser sessions executed on platform.' AS business_definition,
    'core.daily_kpis.total_sessions' AS sql_definition_or_model,
    'day' AS grain,
    'Product Data' AS owner,
    '24h' AS freshness_sla,
    'not_null, daily_completeness' AS quality_tests,
    'v1' AS version,
    DATE '2026-03-02' AS effective_date
UNION ALL
SELECT
    'success_rate_pct',
    TRUE,
    'Daily session success rate percentage (successful_sessions / total_sessions * 100).',
    'core.daily_kpis.success_rate_pct',
    'day',
    'Engineering Data',
    '24h',
    'not_null, 0_to_100_bounds',
    'v1',
    DATE '2026-03-02'
UNION ALL
SELECT
    'daily_active_organizations',
    TRUE,
    'Count of distinct organizations with at least one session on a given day.',
    'core.daily_kpis.daily_active_organizations',
    'day',
    'Growth Data',
    '24h',
    'not_null',
    'v1',
    DATE '2026-03-02'
UNION ALL
SELECT
    'mrr_usd',
    TRUE,
    'Monthly recurring revenue in USD from active subscriptions.',
    'finance.mrr',
    'day',
    'Finance Data',
    '24h',
    'not_null, non_negative',
    'v1',
    DATE '2026-03-02'
UNION ALL
SELECT
    'new_organizations',
    TRUE,
    'Count of newly created organizations per day.',
    'core.daily_kpis.new_organizations',
    'day',
    'Growth Data',
    '24h',
    'not_null',
    'v1',
    DATE '2026-03-02'
