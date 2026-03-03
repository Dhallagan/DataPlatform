// BasedHoc Data Tool definitions and API functions

export interface ReportParameter {
  name: string;
  label: string;
  type: 'date' | 'select' | 'text' | 'number';
  required: boolean;
  default?: string | number;
  options?: { value: string; label: string }[];
  placeholder?: string;
  description?: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category:
    | 'executive'
    | 'revenue'
    | 'growth'
    | 'product'
    | 'ops'
    | 'engineering'
    | 'customer_success'
    | 'tools';
  endpoint: string;
  parameters: ReportParameter[];
}

const DEFAULT_SQL_PARAM: ReportParameter = {
  name: 'sql',
  label: 'SQL',
  type: 'text',
  required: true,
  placeholder: 'Enter SQL query',
  description: 'Preloaded SQL can be edited before running.',
};

export const REPORTS: Record<string, ReportDefinition> = {
  schema_introspection: {
    id: 'schema_introspection',
    name: 'Warehouse Schema Explorer',
    description: 'View modeled warehouse columns from bronze, silver, and analytics schemas.',
    category: 'tools',
    endpoint: '/api/reports/schema',
    parameters: [],
  },
  execute_query: {
    id: 'execute_query',
    name: 'Custom SQL Query',
    description: 'Run ad-hoc SQL against MotherDuck.',
    category: 'tools',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default:
          "SELECT * FROM core.daily_kpis ORDER BY date DESC LIMIT 100",
      },
    ],
  },
  executive_daily_scorecard: {
    id: 'executive_daily_scorecard',
    name: 'Executive Daily Scorecard (30d)',
    description: 'Daily sessions, reliability, growth, and transfer metrics.',
    category: 'executive',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  date,
  total_sessions,
  successful_sessions,
  failed_sessions,
  round(success_rate_pct, 2) AS success_rate_pct,
  daily_active_organizations,
  new_organizations,
  new_users,
  round(total_session_minutes, 1) AS total_session_minutes,
  round(total_gb_transferred, 2) AS total_gb_transferred
FROM core.daily_kpis
WHERE date >= current_date - interval '29 days'
ORDER BY date;`,
      },
    ],
  },
  mrr_trend_12m: {
    id: 'mrr_trend_12m',
    name: 'MRR Trend (12 months)',
    description: 'Total MRR, paying customers, and ARPU over time.',
    category: 'revenue',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  as_of_date,
  total_mrr_usd,
  total_paying_customers,
  round(arpu_usd, 2) AS arpu_usd
FROM finance.mrr
WHERE as_of_date >= current_date - interval '365 days'
ORDER BY as_of_date;`,
      },
    ],
  },
  current_plan_mix: {
    id: 'current_plan_mix',
    name: 'Current Plan Mix',
    description: 'Latest plan-level customers and revenue mix.',
    category: 'revenue',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `WITH latest AS (
  SELECT *
  FROM finance.mrr
  QUALIFY row_number() OVER (ORDER BY as_of_date DESC) = 1
)
SELECT 'starter' AS plan, starter_mrr_usd AS mrr_usd, starter_customers AS customers FROM latest
UNION ALL
SELECT 'pro', pro_mrr_usd, pro_customers FROM latest
UNION ALL
SELECT 'enterprise', enterprise_mrr_usd, enterprise_customers FROM latest
ORDER BY mrr_usd DESC;`,
      },
    ],
  },
  cohort_retention_matrix: {
    id: 'cohort_retention_matrix',
    name: 'Cohort Retention Matrix',
    description: 'Weekly cohort retention by weeks since signup.',
    category: 'growth',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  cohort_week,
  CAST(weeks_since_signup AS INTEGER) AS week_n,
  cohort_size,
  active_orgs,
  round(retention_pct, 2) AS retention_pct
FROM growth.cohort_retention
WHERE cohort_week >= current_date - interval '180 days'
ORDER BY cohort_week, week_n;`,
      },
    ],
  },
  growth_funnel_signup_week: {
    id: 'growth_funnel_signup_week',
    name: 'Growth Funnel by Signup Week',
    description: 'Signup to activation and paying conversion by cohort week.',
    category: 'growth',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `WITH orgs AS (
  SELECT
    organization_id,
    date_trunc('week', organization_created_at)::DATE AS signup_week,
    organization_created_at,
    is_paying_customer
  FROM silver.organizations
  WHERE organization_created_at >= current_date - interval '180 days'
),
activation AS (
  SELECT
    o.organization_id,
    min(s.started_at) AS first_session_at
  FROM orgs o
  LEFT JOIN silver.sessions s
    ON s.organization_id = o.organization_id
  GROUP BY 1
)
SELECT
  o.signup_week,
  count(*) AS signups,
  count(*) FILTER (
    WHERE a.first_session_at IS NOT NULL
      AND a.first_session_at <= o.organization_created_at + interval '7 days'
  ) AS activated_7d,
  count(*) FILTER (WHERE o.is_paying_customer) AS paying_orgs,
  round(
    100.0 * count(*) FILTER (
      WHERE a.first_session_at IS NOT NULL
        AND a.first_session_at <= o.organization_created_at + interval '7 days'
    ) / nullif(count(*), 0), 2
  ) AS activation_rate_7d_pct,
  round(
    100.0 * count(*) FILTER (WHERE o.is_paying_customer) / nullif(count(*), 0), 2
  ) AS paid_rate_pct
FROM orgs o
LEFT JOIN activation a ON a.organization_id = o.organization_id
GROUP BY 1
ORDER BY 1 DESC;`,
      },
    ],
  },
  top_active_orgs_30d: {
    id: 'top_active_orgs_30d',
    name: 'Top Active Organizations (30d)',
    description: 'Most active accounts by recent session volume.',
    category: 'customer_success',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  organization_name,
  current_plan_name,
  is_paying_customer,
  sessions_last_30d,
  lifetime_sessions,
  activity_tier,
  last_session_date
FROM growth.active_organizations
ORDER BY sessions_last_30d DESC
LIMIT 25;`,
      },
    ],
  },
  growth_workflow_qa_dashboard: {
    id: 'growth_workflow_qa_dashboard',
    name: 'Growth Workflow QA Dashboard',
    description: 'Signal-to-task-to-action coverage and execution quality.',
    category: 'growth',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `WITH queue_stats AS (
  SELECT
    COUNT(*) AS queued_tasks,
    COUNT(DISTINCT signal_id) AS queued_signals,
    AVG(signal_score) AS avg_signal_score
  FROM growth.growth_task_queue
),
action_stats AS (
  SELECT
    COUNT(*) AS actions_logged,
    COUNT(*) FILTER (WHERE status = 'success') AS actions_success,
    COUNT(*) FILTER (WHERE status = 'failed') AS actions_failed
  FROM growth.action_log
),
coverage AS (
  SELECT
    COUNT(*) AS queue_without_action
  FROM growth.growth_task_queue q
  LEFT JOIN growth.action_log a
    ON a.task_id = q.task_id
   AND a.signal_id = q.signal_id
  WHERE a.task_id IS NULL
)
SELECT
  current_timestamp AS checked_at,
  q.queued_tasks,
  q.queued_signals,
  round(q.avg_signal_score, 4) AS avg_signal_score,
  a.actions_logged,
  a.actions_success,
  a.actions_failed,
  c.queue_without_action,
  round(100.0 * a.actions_success / nullif(a.actions_logged, 0), 2) AS action_success_rate_pct,
  round(100.0 * (q.queued_tasks - c.queue_without_action) / nullif(q.queued_tasks, 0), 2) AS queue_action_coverage_pct
FROM queue_stats q
CROSS JOIN action_stats a
CROSS JOIN coverage c;`,
      },
    ],
  },
  at_risk_paying_accounts: {
    id: 'at_risk_paying_accounts',
    name: 'At-Risk Paying Accounts',
    description: 'Paying organizations with low recent activity before renewal.',
    category: 'customer_success',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  organization_name,
  current_plan_name,
  current_plan_price_usd,
  days_since_last_session,
  current_period_end::DATE AS renewal_date,
  lifetime_sessions
FROM silver.organizations
WHERE is_paying_customer = true
  AND days_since_last_session >= 14
ORDER BY days_since_last_session DESC, current_plan_price_usd DESC
LIMIT 100;`,
      },
    ],
  },
  engineering_reliability_30d: {
    id: 'engineering_reliability_30d',
    name: 'Engineering Reliability Trend (30d)',
    description: 'Success, failures, errors, and latency trend.',
    category: 'engineering',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  metric_date,
  total_sessions,
  round(success_rate_pct, 2) AS success_rate_pct,
  round(failure_rate_pct, 2) AS failure_rate_pct,
  round(timeout_rate_pct, 2) AS timeout_rate_pct,
  round(errors_per_1k_sessions, 2) AS errors_per_1k_sessions,
  round(p95_duration_seconds, 1) AS p95_duration_seconds
FROM eng.engineering_daily
WHERE metric_date >= current_date - interval '29 days'
ORDER BY metric_date;`,
      },
    ],
  },
  product_adoption_trend_90d: {
    id: 'product_adoption_trend_90d',
    name: 'Product Adoption Trend (90d)',
    description: 'Proxy and stealth adoption with quality signals.',
    category: 'product',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  metric_date,
  total_sessions,
  round(proxy_adoption_pct, 2) AS proxy_adoption_pct,
  round(stealth_adoption_pct, 2) AS stealth_adoption_pct,
  round(success_rate_pct, 2) AS success_rate_pct,
  unique_domains_visited
FROM product.product_daily
WHERE metric_date >= current_date - interval '90 days'
ORDER BY metric_date;`,
      },
    ],
  },
  revenue_collection_quality: {
    id: 'revenue_collection_quality',
    name: 'Revenue Collection Quality',
    description: 'Realized vs pending revenue and invoice collection by month.',
    category: 'revenue',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  revenue_month,
  round(sum(realized_revenue_usd), 2) AS realized_revenue_usd,
  round(sum(pending_revenue_usd), 2) AS pending_revenue_usd,
  round(sum(gross_revenue_usd), 2) AS gross_revenue_usd,
  round(avg(collection_rate_pct), 2) AS avg_collection_rate_pct,
  sum(paid_invoice_count) AS paid_invoices,
  sum(open_invoice_count) AS open_invoices
FROM finance.monthly_revenue
WHERE revenue_month >= date_trunc('month', current_date) - interval '12 months'
GROUP BY 1
ORDER BY 1;`,
      },
    ],
  },
  finance_budget_vs_actual_6m: {
    id: 'finance_budget_vs_actual_6m',
    name: 'Budget vs Actual Spend (6m)',
    description: 'Monthly budget allocation, actual spend, variance, and utilization.',
    category: 'revenue',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  budget_month,
  round(sum(budget_allocated_usd), 2) AS budget_allocated_usd,
  round(sum(actual_spend_usd), 2) AS actual_spend_usd,
  round(sum(budget_variance_usd), 2) AS budget_variance_usd,
  round(
    100.0 * sum(actual_spend_usd) / nullif(sum(budget_allocated_usd), 0),
    2
  ) AS budget_utilization_ratio,
  round(sum(ap_open_usd), 2) AS ap_open_usd
FROM finance.finance_budget_vs_actual_monthly
WHERE budget_month >= date_trunc('month', current_date) - interval '6 months'
GROUP BY 1
ORDER BY 1 DESC;`,
      },
    ],
  },
  ops_kpis_30d: {
    id: 'ops_kpis_30d',
    name: 'Ops KPIs (30d)',
    description: 'Transfer volume, runtime, and infrastructure usage trends.',
    category: 'ops',
    endpoint: '/api/reports/query',
    parameters: [
      {
        ...DEFAULT_SQL_PARAM,
        default: `SELECT
  as_of_date,
  sessions_30d,
  round(total_gb_transferred_30d, 2) AS total_gb_transferred_30d,
  round(total_session_hours_30d, 2) AS total_session_hours_30d,
  round(avg_duration_seconds_30d, 2) AS avg_duration_seconds_30d,
  round(avg_proxy_session_pct_30d, 2) AS avg_proxy_session_pct_30d,
  round(avg_stealth_session_pct_30d, 2) AS avg_stealth_session_pct_30d,
  api_keys_created_30d,
  active_api_keys_created_30d
FROM ops.ops_kpis
ORDER BY as_of_date DESC
LIMIT 90;`,
      },
    ],
  },
};

// Category labels for display
export const CATEGORY_LABELS: Record<string, string> = {
  executive: 'Executive',
  revenue: 'Revenue',
  growth: 'Growth',
  product: 'Product',
  ops: 'Operations',
  engineering: 'Engineering',
  customer_success: 'Customer Success',
  tools: 'Data Tools',
};

export interface ReportResult {
  success: boolean;
  data?: Record<string, unknown>[];
  columns?: string[];
  error?: string;
  row_count?: number;
  total?: number;
  total_outstanding?: number;
  count?: number;
  summary?: Record<string, number>;
  schema?: Record<string, { name: string; type: string }[]>;
}

export async function executeReport(
  reportId: string,
  params: Record<string, unknown>
): Promise<ReportResult> {
  const report = REPORTS[reportId];
  if (!report) {
    throw new Error(`Unknown report: ${reportId}`);
  }

  const method = report.parameters.length === 0 ? 'GET' : 'POST';
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (method === 'POST') {
    // Filter out empty values
    const filteredParams: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== '' && value !== null && value !== undefined) {
        filteredParams[key] = value;
      }
    }
    options.body = JSON.stringify(filteredParams);
  }

  const response = await fetch(report.endpoint, options);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to execute report');
  }

  return response.json();
}

export function validateParams(
  reportId: string,
  params: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } {
  const report = REPORTS[reportId];
  if (!report) {
    return { valid: false, errors: { _: 'Unknown report' } };
  }

  const errors: Record<string, string> = {};

  for (const param of report.parameters) {
    const value = params[param.name];

    if (param.required && (value === '' || value === null || value === undefined)) {
      errors[param.name] = `${param.label} is required`;
      continue;
    }

    if (value && param.type === 'date') {
      const date = new Date(value as string);
      if (isNaN(date.getTime())) {
        errors[param.name] = 'Invalid date format';
      }
    }

    if (value && param.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) {
        errors[param.name] = 'Must be a valid number';
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Get reports by category
export function getReportsByCategory(): Record<string, ReportDefinition[]> {
  const byCategory: Record<string, ReportDefinition[]> = {};

  for (const report of Object.values(REPORTS)) {
    if (!byCategory[report.category]) {
      byCategory[report.category] = [];
    }
    byCategory[report.category].push(report);
  }

  return byCategory;
}
