{{ config(alias='agg_cohort_retention_weekly') }}

-- =============================================================================
-- METRIC VIEW: Cohort Retention
-- =============================================================================
-- Definition: Weekly retention cohorts based on organization signup
-- Purpose: Track how long organizations remain active after signing up
-- =============================================================================

WITH org_cohorts AS (
    -- Assign each org to its signup cohort (week)
    SELECT
        organization_id,
        DATE_TRUNC('week', organization_created_at)::DATE AS cohort_week
    FROM {{ ref('organizations') }}
    WHERE organization_status = 'active'
),

org_weekly_activity AS (
    -- Get weekly activity per org
    SELECT DISTINCT
        organization_id,
        DATE_TRUNC('week', session_date)::DATE AS activity_week
    FROM {{ ref('sessions') }}
),

cohort_activity AS (
    -- Join cohorts with their activity
    SELECT
        c.cohort_week,
        c.organization_id,
        a.activity_week,
        (a.activity_week - c.cohort_week) / 7 AS weeks_since_signup
    FROM org_cohorts c
    LEFT JOIN org_weekly_activity a ON c.organization_id = a.organization_id
    WHERE a.activity_week >= c.cohort_week
),

cohort_sizes AS (
    -- Get size of each cohort
    SELECT
        cohort_week,
        COUNT(DISTINCT organization_id) AS cohort_size
    FROM org_cohorts
    GROUP BY 1
),

retention_by_week AS (
    -- Calculate retention for each cohort × week_number
    SELECT
        ca.cohort_week,
        ca.weeks_since_signup,
        COUNT(DISTINCT ca.organization_id) AS active_orgs
    FROM cohort_activity ca
    GROUP BY 1, 2
)

SELECT
    r.cohort_week,
    cs.cohort_size,
    r.weeks_since_signup,
    r.active_orgs,
    ROUND(r.active_orgs::DECIMAL / cs.cohort_size * 100, 2) AS retention_pct
    
FROM retention_by_week r
JOIN cohort_sizes cs ON r.cohort_week = cs.cohort_week
WHERE r.weeks_since_signup <= 12  -- Show up to 12 weeks of retention
ORDER BY r.cohort_week, r.weeks_since_signup
