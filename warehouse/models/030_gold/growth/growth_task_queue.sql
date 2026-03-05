-- =============================================================================
-- WORKFLOW TABLE: Growth Task Queue
-- =============================================================================
-- Grain: 1 row per queued task
-- Purpose: Queue high-risk trial organizations for growth intervention.
-- =============================================================================

WITH high_risk_threshold AS (
    SELECT threshold_value
    FROM {{ ref('signal_thresholds') }}
    WHERE signal_name = 'trial_conversion_risk'
      AND threshold_name = 'high_risk'
      AND is_active = TRUE
),

signals AS (
    SELECT * FROM {{ ref('signal_trial_conversion_risk_daily') }}
),

final AS (
    SELECT
        CONCAT('growth_task|', s.signal_id) AS task_id,
        s.signal_id,
        s.organization_id,
        s.organization_name,
        'growth_trial_save' AS queue_name,
        'intervene_trial_conversion' AS action_type,
        CASE
            WHEN s.signal_score >= 0.90 THEN 'urgent'
            WHEN s.signal_score >= 0.80 THEN 'high'
            ELSE 'normal'
        END AS priority,
        'pending' AS task_status,
        s.reason_code,
        s.signal_score,
        s.triggered_at AS created_at,
        s.expires_at AS due_at,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM signals s
    CROSS JOIN high_risk_threshold t
    WHERE s.signal_score >= t.threshold_value
)

SELECT * FROM final
