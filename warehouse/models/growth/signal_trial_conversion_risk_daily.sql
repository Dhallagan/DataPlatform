-- =============================================================================
-- SIGNAL TABLE: Trial Conversion Risk (Daily)
-- =============================================================================
-- Grain: 1 row per organization per day
-- Purpose: Rank trial organizations by conversion risk for growth workflows.
-- =============================================================================

WITH trial_subscriptions AS (
    SELECT *
    FROM (
        SELECT
            s.subscription_id,
            s.organization_id,
            s.subscription_status,
            s.is_in_trial,
            s.trial_ends_at,
            s.subscription_created_at,
            ROW_NUMBER() OVER (
                PARTITION BY s.organization_id
                ORDER BY s.subscription_created_at DESC
            ) AS rn
        FROM {{ ref('fct_subscriptions') }} s
        WHERE s.is_in_trial = TRUE
           OR s.subscription_status = 'trialing'
    ) ranked
    WHERE rn = 1
),

org_usage_7d AS (
    SELECT
        r.organization_id,
        COUNT(*) AS total_runs_7d,
        SUM(CASE WHEN r.is_successful THEN 1 ELSE 0 END) AS successful_runs_7d,
        SUM(COALESCE(r.error_count, 0)) AS error_events_7d,
        MAX(r.run_date) AS last_run_date
    FROM {{ ref('fct_runs') }} r
    WHERE r.run_date >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY 1
),

base AS (
    SELECT
        o.organization_id,
        o.organization_name,
        t.subscription_id,
        t.trial_ends_at,
        COALESCE(u.total_runs_7d, 0) AS total_runs_7d,
        COALESCE(u.successful_runs_7d, 0) AS successful_runs_7d,
        COALESCE(u.error_events_7d, 0) AS error_events_7d,
        u.last_run_date,

        CASE
            WHEN COALESCE(u.total_runs_7d, 0) = 0 THEN 0.0
            ELSE COALESCE(u.successful_runs_7d, 0)::DOUBLE / NULLIF(u.total_runs_7d, 0)
        END AS success_rate_7d,

        EXTRACT(DAY FROM (t.trial_ends_at - CURRENT_TIMESTAMP))::INTEGER AS days_remaining_in_trial
    FROM {{ ref('organizations') }} o
    INNER JOIN trial_subscriptions t ON o.organization_id = t.organization_id
    LEFT JOIN org_usage_7d u ON o.organization_id = u.organization_id
    WHERE o.organization_status = 'active'
),

scored AS (
    SELECT
        b.*,

        CASE
            WHEN b.total_runs_7d = 0 THEN 1.00
            WHEN b.successful_runs_7d = 0 THEN 0.90
            WHEN b.successful_runs_7d < 3 THEN 0.70
            ELSE 0.20
        END AS activation_risk_component,

        CASE
            WHEN b.total_runs_7d = 0 THEN 0.70
            WHEN b.success_rate_7d < 0.50 THEN 0.80
            WHEN b.success_rate_7d < 0.80 THEN 0.50
            ELSE 0.10
        END AS reliability_risk_component,

        CASE
            WHEN b.days_remaining_in_trial <= 2 THEN 1.00
            WHEN b.days_remaining_in_trial <= 5 THEN 0.70
            WHEN b.days_remaining_in_trial <= 10 THEN 0.40
            ELSE 0.10
        END AS urgency_risk_component
    FROM base b
),

final AS (
    SELECT
        CONCAT(s.organization_id, '|', CURRENT_DATE::TEXT, '|trial_conversion_risk') AS signal_id,
        'trial_conversion_risk' AS signal_name,
        'organization' AS object_type,
        s.organization_id AS object_id,
        s.organization_id,
        s.organization_name,
        s.subscription_id,
        s.trial_ends_at,
        s.total_runs_7d,
        s.successful_runs_7d,
        s.error_events_7d,
        s.success_rate_7d,
        s.days_remaining_in_trial,

        LEAST(
            1.0,
            GREATEST(
                0.0,
                (
                    0.50 * s.activation_risk_component +
                    0.30 * s.reliability_risk_component +
                    0.20 * s.urgency_risk_component
                )
            )
        ) AS signal_score,

        CASE
            WHEN s.total_runs_7d = 0 THEN 'no_recent_usage'
            WHEN s.successful_runs_7d = 0 THEN 'no_successful_runs'
            WHEN s.success_rate_7d < 0.50 THEN 'low_success_rate'
            WHEN s.days_remaining_in_trial <= 2 THEN 'trial_ending_soon'
            ELSE 'composite_risk'
        END AS reason_code,

        CURRENT_TIMESTAMP AS triggered_at,
        CURRENT_TIMESTAMP + INTERVAL '24 hours' AS expires_at,
        'v1' AS version,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM scored s
)

SELECT * FROM final
