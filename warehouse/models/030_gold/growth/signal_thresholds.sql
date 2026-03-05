{{ config(alias='cfg_signal_thresholds') }}

-- =============================================================================
-- CONFIG TABLE: Signal Thresholds
-- =============================================================================
-- Purpose: Centralized thresholds for operational signal routing.
-- =============================================================================

{{ config(materialized='table') }}

SELECT
    'trial_conversion_risk'::TEXT AS signal_name,
    'high_risk'::TEXT AS threshold_name,
    0.80::DECIMAL(10,4) AS threshold_value,
    '>='::TEXT AS comparator,
    TRUE AS is_active,
    CURRENT_TIMESTAMP AS _loaded_at

UNION ALL

SELECT
    'trial_conversion_risk'::TEXT AS signal_name,
    'medium_risk'::TEXT AS threshold_name,
    0.60::DECIMAL(10,4) AS threshold_value,
    '>='::TEXT AS comparator,
    TRUE AS is_active,
    CURRENT_TIMESTAMP AS _loaded_at
