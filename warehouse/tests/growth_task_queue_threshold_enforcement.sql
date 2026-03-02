-- Fail rows where queued tasks do not meet the active high-risk threshold.
WITH threshold AS (
    SELECT threshold_value
    FROM {{ ref('signal_thresholds') }}
    WHERE signal_name = 'trial_conversion_risk'
      AND threshold_name = 'high_risk'
      AND is_active = TRUE
)

SELECT
    q.task_id,
    q.signal_id,
    q.signal_score,
    t.threshold_value
FROM {{ ref('growth_task_queue') }} q
CROSS JOIN threshold t
WHERE q.signal_score < t.threshold_value
