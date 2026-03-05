-- =============================================================================
-- BRIDGE: Organization Activity
-- =============================================================================
-- Source: stg_sessions
-- Grain: 1 row per organization
-- Purpose: Session activity aggregates split from dim_organizations
-- =============================================================================

WITH session_stats AS (
    SELECT
        organization_id,
        COUNT(*) AS total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_sessions,
        MIN(created_at) AS first_session_at,
        MAX(created_at) AS last_session_at
    FROM {{ ref('stg_sessions') }}
    GROUP BY 1
),

final AS (
    SELECT
        organization_id,
        total_sessions,
        completed_sessions,
        first_session_at,
        last_session_at,
        CASE
            WHEN last_session_at IS NOT NULL
            THEN EXTRACT(DAY FROM (CURRENT_TIMESTAMP - last_session_at))::INTEGER
            ELSE NULL
        END AS days_since_last_session,
        CURRENT_TIMESTAMP AS _loaded_at
    FROM session_stats
)

SELECT * FROM final
