{{ config(alias='terminal_customer_daily') }}

-- =============================================================================
-- FACT VIEW: Customer Terminal Daily
-- =============================================================================
-- Grain: 1 row per organization_id x metric_date
-- Purpose: Customer-level daily operational + financial context for drilldowns
-- =============================================================================

WITH risk AS (
    SELECT
        organization_id,
        DATE(triggered_at) AS metric_date,
        MAX(signal_score) AS signal_score,
        MAX(success_rate_7d) AS success_rate_7d,
        MAX(total_runs_7d) AS total_runs_7d,
        MIN(days_remaining_in_trial) AS days_remaining_in_trial
    FROM {{ ref('signal_trial_conversion_risk_daily') }}
    GROUP BY 1, 2
),

revenue_monthly AS (
    SELECT
        organization_id,
        revenue_month,
        MAX(organization_name) AS organization_name,
        MAX(current_plan_name) AS current_plan_name,
        SUM(realized_revenue_usd) AS realized_revenue_usd,
        SUM(pending_revenue_usd) AS pending_revenue_usd,
        AVG(collection_rate_pct) AS collection_rate_pct
    FROM {{ ref('monthly_revenue') }}
    GROUP BY 1, 2
),

queue AS (
    SELECT
        organization_id,
        DATE(created_at) AS metric_date,
        COUNT(*) AS queued_tasks,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) AS urgent_tasks
    FROM {{ ref('growth_task_queue') }}
    GROUP BY 1, 2
),

calendar AS (
    SELECT organization_id, metric_date FROM risk
    UNION
    SELECT organization_id, metric_date FROM queue
)

SELECT
    c.organization_id,
    c.metric_date,
    rm.organization_name,
    rm.current_plan_name,
    rm.realized_revenue_usd,
    rm.pending_revenue_usd,
    rm.collection_rate_pct,
    r.signal_score,
    r.success_rate_7d,
    r.total_runs_7d,
    r.days_remaining_in_trial,
    q.queued_tasks,
    q.urgent_tasks,
    CURRENT_TIMESTAMP AS _loaded_at
FROM calendar c
LEFT JOIN risk r
  ON c.organization_id = r.organization_id
 AND c.metric_date = r.metric_date
LEFT JOIN queue q
  ON c.organization_id = q.organization_id
 AND c.metric_date = q.metric_date
LEFT JOIN revenue_monthly rm
  ON c.organization_id = rm.organization_id
 AND DATE_TRUNC('month', c.metric_date) = rm.revenue_month
ORDER BY c.metric_date DESC, c.organization_id
