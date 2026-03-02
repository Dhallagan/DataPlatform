-- Fail rows where trial conversion risk scores are outside [0, 1].
SELECT
    signal_id,
    organization_id,
    signal_score
FROM {{ ref('signal_trial_conversion_risk_daily') }}
WHERE signal_score < 0
   OR signal_score > 1
