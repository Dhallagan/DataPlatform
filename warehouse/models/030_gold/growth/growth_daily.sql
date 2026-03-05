{{ config(alias='agg_growth_daily') }}

-- =============================================================================
-- FACT TABLE: Growth Daily
-- =============================================================================
-- Grain: 1 row per day
-- Purpose: Growth funnel and active customer trends
-- =============================================================================

WITH sessions AS (
    SELECT * FROM {{ ref('sessions') }}
),

organizations AS (
    SELECT * FROM {{ ref('organizations') }}
),

users AS (
    SELECT * FROM {{ ref('users') }}
),

calendar AS (
    SELECT DISTINCT session_date AS metric_date FROM sessions
    UNION
    SELECT DISTINCT DATE(organization_created_at) AS metric_date FROM organizations
    UNION
    SELECT DISTINCT DATE(user_created_at) AS metric_date FROM users
),

first_org_session AS (
    SELECT
        organization_id,
        MIN(session_date) AS first_session_date
    FROM sessions
    GROUP BY 1
),

org_growth AS (
    SELECT
        DATE(organization_created_at) AS metric_date,
        COUNT(*) AS new_organizations
    FROM organizations
    GROUP BY 1
),

user_growth AS (
    SELECT
        DATE(user_created_at) AS metric_date,
        COUNT(*) AS new_users
    FROM users
    GROUP BY 1
),

daily_sessions AS (
    SELECT
        session_date AS metric_date,
        COUNT(*) AS total_sessions,
        COUNT(DISTINCT organization_id) AS active_orgs_dau
    FROM sessions
    GROUP BY 1
),

final AS (
    SELECT
        c.metric_date,

        COALESCE(og.new_organizations, 0) AS new_organizations,
        COALESCE(ug.new_users, 0) AS new_users,
        COALESCE(ds.total_sessions, 0) AS total_sessions,
        COALESCE(ds.active_orgs_dau, 0) AS active_orgs_dau,

        (
            SELECT COUNT(DISTINCT s.organization_id)
            FROM sessions s
            WHERE s.session_date BETWEEN c.metric_date - INTERVAL '6 days' AND c.metric_date
        ) AS active_orgs_wau,

        (
            SELECT COUNT(DISTINCT s.organization_id)
            FROM sessions s
            WHERE s.session_date BETWEEN c.metric_date - INTERVAL '29 days' AND c.metric_date
        ) AS active_orgs_mau,

        (
            SELECT COUNT(*)
            FROM organizations o
            LEFT JOIN first_org_session fos ON o.organization_id = fos.organization_id
            WHERE DATE(o.organization_created_at) = c.metric_date
              AND fos.first_session_date <= DATE(o.organization_created_at) + INTERVAL '7 days'
        ) AS activated_orgs_7d,

        ROUND(
            (
                SELECT COUNT(*)
                FROM organizations o
                LEFT JOIN first_org_session fos ON o.organization_id = fos.organization_id
                WHERE DATE(o.organization_created_at) = c.metric_date
                  AND fos.first_session_date <= DATE(o.organization_created_at) + INTERVAL '7 days'
            )::DECIMAL
            / NULLIF(COALESCE(og.new_organizations, 0), 0) * 100,
            2
        ) AS activation_rate_7d_pct,

        CURRENT_TIMESTAMP AS _loaded_at

    FROM calendar c
    LEFT JOIN org_growth og ON c.metric_date = og.metric_date
    LEFT JOIN user_growth ug ON c.metric_date = ug.metric_date
    LEFT JOIN daily_sessions ds ON c.metric_date = ds.metric_date
)

SELECT * FROM final
