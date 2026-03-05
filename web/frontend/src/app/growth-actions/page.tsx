'use client';

import { useEffect, useMemo, useState } from 'react';
import Toolbar from '@/components/Toolbar';
import MetricHelpButton from '@/components/MetricHelpButton';
import { getMetricContract } from '@/lib/metricGlossary';

interface QueryPayload {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}

interface GrowthTaskRow {
  task_id: string;
  organization_name: string;
  signal_score: number;
  priority: string;
  reason_code: string;
  due_at: string;
  recommended_action: string;
  recommended_channel: string;
}

interface LeadTrendRow {
  metric_date: string;
  leads_created: number;
  inbound_leads: number;
  outbound_leads: number;
  qualified_leads_created: number;
  leads_converted: number;
  opportunities_created: number;
  opportunities_amount_created_usd: number;
  opportunities_closed_won: number;
  closed_won_amount_usd: number;
}

interface PipelineSnapshotRow {
  as_of_date: string;
  leads_total: number;
  leads_new: number;
  leads_working: number;
  leads_qualified: number;
  open_pipeline_usd: number;
  won_revenue_usd: number;
  lead_conversion_rate_pct: number;
  opportunity_win_rate_pct: number;
}

interface ActionSummaryRow {
  action_type: string;
  status: string;
  action_count_7d: number;
}

function asString(value: unknown): string {
  return value == null ? '' : String(value);
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toGrowthTaskRows(rows: Record<string, unknown>[]): GrowthTaskRow[] {
  return rows.map((row) => ({
    task_id: asString(row.task_id),
    organization_name: asString(row.organization_name),
    signal_score: asNumber(row.signal_score),
    priority: asString(row.priority),
    reason_code: asString(row.reason_code),
    due_at: asString(row.due_at),
    recommended_action: asString(row.recommended_action),
    recommended_channel: asString(row.recommended_channel),
  }));
}

function toLeadTrendRows(rows: Record<string, unknown>[]): LeadTrendRow[] {
  return rows.map((row) => ({
    metric_date: asString(row.metric_date),
    leads_created: asNumber(row.leads_created),
    inbound_leads: asNumber(row.inbound_leads),
    outbound_leads: asNumber(row.outbound_leads),
    qualified_leads_created: asNumber(row.qualified_leads_created),
    leads_converted: asNumber(row.leads_converted),
    opportunities_created: asNumber(row.opportunities_created),
    opportunities_amount_created_usd: asNumber(row.opportunities_amount_created_usd),
    opportunities_closed_won: asNumber(row.opportunities_closed_won),
    closed_won_amount_usd: asNumber(row.closed_won_amount_usd),
  }));
}

function toPipelineSnapshotRow(row: Record<string, unknown> | undefined): PipelineSnapshotRow | null {
  if (!row) return null;
  return {
    as_of_date: asString(row.as_of_date),
    leads_total: asNumber(row.leads_total),
    leads_new: asNumber(row.leads_new),
    leads_working: asNumber(row.leads_working),
    leads_qualified: asNumber(row.leads_qualified),
    open_pipeline_usd: asNumber(row.open_pipeline_usd),
    won_revenue_usd: asNumber(row.won_revenue_usd),
    lead_conversion_rate_pct: asNumber(row.lead_conversion_rate_pct),
    opportunity_win_rate_pct: asNumber(row.opportunity_win_rate_pct),
  };
}

function toActionSummaryRows(rows: Record<string, unknown>[]): ActionSummaryRow[] {
  return rows.map((row) => ({
    action_type: asString(row.action_type),
    status: asString(row.status),
    action_count_7d: asNumber(row.action_count_7d),
  }));
}

function fmtNumber(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

function fmtMoney(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '$0';
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(value: unknown): string {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0%';
  return `${n.toFixed(1)}%`;
}

export default function GrowthActionsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<GrowthTaskRow[]>([]);
  const [leadTrend, setLeadTrend] = useState<LeadTrendRow[]>([]);
  const [snapshot, setSnapshot] = useState<PipelineSnapshotRow | null>(null);
  const [actions, setActions] = useState<ActionSummaryRow[]>([]);
  const [localCallQueue, setLocalCallQueue] = useState<Record<string, boolean>>({});

  async function runQuery(sql: string): Promise<Record<string, unknown>[]> {
    const response = await fetch('/api/reports/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    const payload = (await response.json()) as QueryPayload;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error || 'Query failed');
    }
    return payload.data;
  }

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [taskRows, leadTrendRows, snapRows, actionRows] = await Promise.all([
        runQuery(`
          SELECT
            task_id,
            organization_name,
            signal_score,
            priority,
            reason_code,
            due_at,
            CASE
              WHEN reason_code IN ('no_recent_usage', 'no_successful_runs') THEN 'Run onboarding rescue sequence'
              WHEN reason_code = 'low_success_rate' THEN 'Schedule technical success review'
              WHEN reason_code = 'trial_ending_soon' THEN 'Exec close plan + pricing call'
              ELSE 'Manual growth triage'
            END AS recommended_action,
            CASE
              WHEN signal_score >= 0.90 THEN '11labs_call'
              WHEN signal_score >= 0.80 THEN 'email_then_call'
              ELSE 'email'
            END AS recommended_channel
          FROM gtm.growth_task_queue
          WHERE task_status = 'pending'
          ORDER BY
            CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
            signal_score DESC,
            due_at ASC
          LIMIT 50
        `),
        runQuery(`
          SELECT
            metric_date,
            leads_created,
            inbound_leads,
            outbound_leads,
            qualified_leads_created,
            leads_converted,
            opportunities_created,
            opportunities_amount_created_usd,
            opportunities_closed_won,
            closed_won_amount_usd
          FROM gtm.agg_funnel_daily
          WHERE metric_date >= CURRENT_DATE - INTERVAL '14 days'
          ORDER BY metric_date DESC
          LIMIT 30
        `),
        runQuery(`
          SELECT
            as_of_date,
            leads_total,
            leads_new,
            leads_working,
            leads_qualified,
            open_pipeline_usd,
            won_revenue_usd,
            lead_conversion_rate_pct,
            opportunity_win_rate_pct
          FROM gtm.snap_pipeline_daily
          ORDER BY as_of_date DESC
          LIMIT 1
        `),
        runQuery(`
          SELECT
            action_type,
            status,
            COUNT(*) AS action_count_7d
          FROM gtm.action_log
          WHERE executed_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
          GROUP BY 1, 2
          ORDER BY action_count_7d DESC, action_type
          LIMIT 20
        `),
      ]);

      setTasks(toGrowthTaskRows(taskRows));
      setLeadTrend(toLeadTrendRows(leadTrendRows));
      setSnapshot(toPipelineSnapshotRow(snapRows[0]));
      setActions(toActionSummaryRows(actionRows));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load growth actions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const urgentTaskCount = useMemo(
    () => tasks.filter((task) => task.priority === 'urgent').length,
    [tasks]
  );

  const callRecommendedCount = useMemo(
    () => tasks.filter((task) => task.recommended_channel === '11labs_call').length,
    [tasks]
  );

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-surface-elevated border border-border rounded-lg p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-content-primary">Growth Action Dashboard</h1>
            <p className="text-sm text-content-tertiary mt-1">
              Operate new leads and trial-risk signals with clear next actions.
            </p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg text-sm bg-surface-tertiary hover:bg-surface-primary text-content-primary"
            disabled={isLoading}
          >
            Refresh
          </button>
        </section>

        {error && (
          <section className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-700">
            {error}
          </section>
        )}

        {isLoading ? (
          <section className="bg-surface-elevated border border-border rounded-lg p-5 text-sm text-content-tertiary">
            Loading growth actions...
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">Pending Tasks</p>
                  <MetricHelpButton contract={getMetricContract('growth_actions.pending_tasks')} />
                </div>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtNumber(tasks.length)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">Urgent Tasks</p>
                  <MetricHelpButton contract={getMetricContract('growth_actions.urgent_tasks')} />
                </div>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtNumber(urgentTaskCount)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">11Labs Call Candidates</p>
                  <MetricHelpButton contract={getMetricContract('growth_actions.call_candidates')} />
                </div>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtNumber(callRecommendedCount)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">Open Pipeline</p>
                  <MetricHelpButton contract={getMetricContract('growth_actions.open_pipeline')} />
                </div>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtMoney(snapshot?.open_pipeline_usd)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">Lead Conversion</p>
                  <MetricHelpButton contract={getMetricContract('growth_actions.lead_conversion')} />
                </div>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtPct(snapshot?.lead_conversion_rate_pct)}</p>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-base font-semibold text-content-primary">Signal Task Queue</h2>
                  <MetricHelpButton contract={getMetricContract('growth_actions.signal_task_queue')} />
                </div>
                <div className="overflow-auto max-h-[460px] border border-border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-primary sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 border-b border-border">Org</th>
                        <th className="text-left px-3 py-2 border-b border-border">Priority</th>
                        <th className="text-left px-3 py-2 border-b border-border">Score</th>
                        <th className="text-left px-3 py-2 border-b border-border">Reason</th>
                        <th className="text-left px-3 py-2 border-b border-border">Recommended Action</th>
                        <th className="text-left px-3 py-2 border-b border-border">Due</th>
                        <th className="text-left px-3 py-2 border-b border-border">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((row) => (
                        <tr key={row.task_id} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                          <td className="px-3 py-2 border-t border-border text-content-primary">{row.organization_name}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{row.priority}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{Number(row.signal_score).toFixed(2)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-tertiary font-mono">{row.reason_code}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{row.recommended_action}</td>
                          <td className="px-3 py-2 border-t border-border text-content-tertiary">
                            {row.due_at ? new Date(row.due_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-3 py-2 border-t border-border">
                            <button
                              onClick={() => setLocalCallQueue((prev) => ({ ...prev, [row.task_id]: true }))}
                              className="px-2 py-1 rounded text-[11px] border border-border bg-surface-primary hover:bg-surface-tertiary text-content-primary"
                            >
                              {localCallQueue[row.task_id]
                                ? 'Queued'
                                : row.recommended_channel === '11labs_call'
                                  ? 'Queue 11Labs'
                                  : 'Create Task'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {tasks.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-content-tertiary">
                            No pending growth tasks found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-elevated border border-border rounded-lg p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-content-primary">Pipeline Snapshot</h2>
                    <MetricHelpButton contract={getMetricContract('growth_actions.pipeline_snapshot')} />
                  </div>
                  <p className="text-xs text-content-tertiary mt-1">
                    {snapshot?.as_of_date ? `As of ${new Date(snapshot.as_of_date).toLocaleDateString()}` : 'No snapshot row'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-surface-primary border border-border rounded p-3">
                    <p className="text-xs text-content-tertiary">Leads Total</p>
                    <p className="text-content-primary font-semibold">{fmtNumber(snapshot?.leads_total)}</p>
                  </div>
                  <div className="bg-surface-primary border border-border rounded p-3">
                    <p className="text-xs text-content-tertiary">Leads New</p>
                    <p className="text-content-primary font-semibold">{fmtNumber(snapshot?.leads_new)}</p>
                  </div>
                  <div className="bg-surface-primary border border-border rounded p-3">
                    <p className="text-xs text-content-tertiary">Leads Working</p>
                    <p className="text-content-primary font-semibold">{fmtNumber(snapshot?.leads_working)}</p>
                  </div>
                  <div className="bg-surface-primary border border-border rounded p-3">
                    <p className="text-xs text-content-tertiary">Leads Qualified</p>
                    <p className="text-content-primary font-semibold">{fmtNumber(snapshot?.leads_qualified)}</p>
                  </div>
                  <div className="bg-surface-primary border border-border rounded p-3">
                    <p className="text-xs text-content-tertiary">Won Revenue</p>
                    <p className="text-content-primary font-semibold">{fmtMoney(snapshot?.won_revenue_usd)}</p>
                  </div>
                  <div className="bg-surface-primary border border-border rounded p-3">
                    <p className="text-xs text-content-tertiary">Win Rate</p>
                    <p className="text-content-primary font-semibold">{fmtPct(snapshot?.opportunity_win_rate_pct)}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-content-primary">Recent Action Throughput (7d)</h3>
                    <MetricHelpButton contract={getMetricContract('growth_actions.action_throughput_7d')} />
                  </div>
                  <div className="space-y-1 max-h-[160px] overflow-auto">
                    {actions.length === 0 && <p className="text-xs text-content-tertiary">No action log rows in last 7 days.</p>}
                    {actions.map((row, idx) => (
                      <div key={`${row.action_type}-${row.status}-${idx}`} className="flex items-center justify-between text-xs border border-border rounded px-2 py-1 bg-surface-primary">
                        <span className="font-mono text-content-primary">{row.action_type}</span>
                        <span className="text-content-tertiary">{row.status}</span>
                        <span className="text-content-primary">{fmtNumber(row.action_count_7d)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-surface-elevated border border-border rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-base font-semibold text-content-primary">Lead Intake Trend (14d)</h2>
                <MetricHelpButton contract={getMetricContract('growth_actions.lead_intake_trend')} />
              </div>
              <div className="overflow-auto max-h-[420px] border border-border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-surface-primary sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 border-b border-border">Date</th>
                      <th className="text-left px-3 py-2 border-b border-border">Leads Created</th>
                      <th className="text-left px-3 py-2 border-b border-border">Inbound</th>
                      <th className="text-left px-3 py-2 border-b border-border">Outbound</th>
                      <th className="text-left px-3 py-2 border-b border-border">Qualified</th>
                      <th className="text-left px-3 py-2 border-b border-border">Converted</th>
                      <th className="text-left px-3 py-2 border-b border-border">Opps Created</th>
                      <th className="text-left px-3 py-2 border-b border-border">Opps Amount</th>
                      <th className="text-left px-3 py-2 border-b border-border">Closed Won</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadTrend.map((row) => (
                      <tr key={row.metric_date} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                        <td className="px-3 py-2 border-t border-border text-content-primary">{new Date(row.metric_date).toLocaleDateString()}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.leads_created)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtNumber(row.inbound_leads)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtNumber(row.outbound_leads)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.qualified_leads_created)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.leads_converted)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.opportunities_created)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtMoney(row.opportunities_amount_created_usd)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.opportunities_closed_won)}</td>
                      </tr>
                    ))}
                    {leadTrend.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-4 text-center text-content-tertiary">
                          No recent lead trend rows available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
