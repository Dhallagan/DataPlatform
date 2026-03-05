{{ config(alias='kpi_growth') }}

-- =============================================================================
-- METRIC VIEW: Growth KPIs (30d)
-- =============================================================================

WITH recent AS (
    SELECT *
    FROM {{ ref('growth_daily') }}
    WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
)

SELECT
    CURRENT_DATE AS as_of_date,
    SUM(new_organizations) AS new_organizations_30d,
    SUM(new_users) AS new_users_30d,
    SUM(total_sessions) AS total_sessions_30d,
    MAX(active_orgs_dau) AS peak_dau_30d,
    MAX(active_orgs_wau) AS peak_wau_30d,
    MAX(active_orgs_mau) AS peak_mau_30d,
    ROUND(AVG(activation_rate_7d_pct), 2) AS avg_activation_rate_7d_pct,
    CURRENT_TIMESTAMP AS _calculated_at
FROM recent
