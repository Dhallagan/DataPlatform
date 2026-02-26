-- =============================================================================
-- FACT: Browser Runs
-- =============================================================================
-- Grain: 1 row per browser run/session
-- Purpose: Canonical product usage fact
-- =============================================================================

SELECT
    session_id AS run_id,
    organization_id,
    project_id,
    api_key_id,
    session_status AS run_status,
    is_successful,
    started_at AS run_ts_start,
    ended_at AS run_ts_end,
    session_date AS run_date,
    duration_seconds,
    pages_visited,
    used_proxy,
    is_stealth_mode,
    bytes_downloaded,
    bytes_uploaded,
    total_bytes_transferred,
    event_count,
    error_count,
    _loaded_at
FROM {{ ref('core_sessions') }}
