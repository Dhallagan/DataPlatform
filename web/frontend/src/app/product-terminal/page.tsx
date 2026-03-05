'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  LoadingState,
  StatTile,
} from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import { num, pct, runWarehouseQuery, runWarehouseQuerySafe } from '@/lib/warehouse';

interface ProductKpiSnapshot {
  sessions_7d: number;
  sessions_prev_7d: number;
  success_rate_7d: number;
  success_rate_prev_7d: number;
  failed_runs_7d: number;
  failed_runs_prev_7d: number;
  active_orgs_7d: number;
  active_orgs_prev_7d: number;
  avg_duration_7d: number;
  avg_duration_prev_7d: number;
  proxy_adoption_7d: number;
  proxy_adoption_prev_7d: number;
}

interface DailyRow {
  metric_date: string;
  total_sessions: number;
  success_rate_pct: number;
  avg_duration_seconds: number;
  proxy_adoption_pct: number;
  stealth_adoption_pct: number;
}

interface OpsRow {
  metric_date: string;
  total_sessions: number;
  total_gb_transferred: number;
  avg_duration_seconds: number;
  proxy_session_pct: number;
}

interface FailureQueueRow {
  owner: string;
  failure_type: string;
  failed_runs: number;
  affected_orgs: number;
  affected_projects: number;
  avg_duration_seconds: number;
  impact_score: number;
  recommended_action: string;
}

function delta(current: number, previous: number): string {
  const d = current - previous;
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}`;
}

function deltaInt(current: number, previous: number): string {
  const d = current - previous;
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(0)}`;
}

export default function ProductTerminalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<ProductKpiSnapshot | null>(null);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [opsRows, setOpsRows] = useState<OpsRow[]>([]);
  const [failureQueue, setFailureQueue] = useState<FailureQueueRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [kpiRows, daily, ops, failures] = await Promise.all([
          runWarehouseQuery(`
            WITH current_window AS (
              SELECT
                SUM(total_sessions) AS sessions_7d,
                SUM(successful_sessions) AS successful_7d,
                SUM(failed_sessions) AS failed_7d,
                ROUND(AVG(active_orgs), 0) AS active_orgs_7d,
                AVG(avg_duration_seconds) AS avg_duration_7d,
                AVG(proxy_adoption_pct) AS proxy_adoption_7d
              FROM pro.agg_product_daily
              WHERE metric_date >= current_date - interval '6 days'
            ),
            previous_window AS (
              SELECT
                SUM(total_sessions) AS sessions_prev_7d,
                SUM(successful_sessions) AS successful_prev_7d,
                SUM(failed_sessions) AS failed_prev_7d,
                ROUND(AVG(active_orgs), 0) AS active_orgs_prev_7d,
                AVG(avg_duration_seconds) AS avg_duration_prev_7d,
                AVG(proxy_adoption_pct) AS proxy_adoption_prev_7d
              FROM pro.agg_product_daily
              WHERE metric_date >= current_date - interval '13 days'
                AND metric_date < current_date - interval '6 days'
            )
            SELECT
              c.sessions_7d,
              p.sessions_prev_7d,
              ROUND(100.0 * c.successful_7d / NULLIF(c.sessions_7d, 0), 2) AS success_rate_7d,
              ROUND(100.0 * p.successful_prev_7d / NULLIF(p.sessions_prev_7d, 0), 2) AS success_rate_prev_7d,
              c.failed_7d AS failed_runs_7d,
              p.failed_prev_7d AS failed_runs_prev_7d,
              c.active_orgs_7d,
              p.active_orgs_prev_7d,
              ROUND(c.avg_duration_7d, 2) AS avg_duration_7d,
              ROUND(p.avg_duration_prev_7d, 2) AS avg_duration_prev_7d,
              ROUND(c.proxy_adoption_7d, 2) AS proxy_adoption_7d,
              ROUND(p.proxy_adoption_prev_7d, 2) AS proxy_adoption_prev_7d
            FROM current_window c
            CROSS JOIN previous_window p
          `),
          runWarehouseQuerySafe(`SELECT metric_date, total_sessions, success_rate_pct, avg_duration_seconds, proxy_adoption_pct, stealth_adoption_pct FROM pro.agg_product_daily ORDER BY metric_date DESC LIMIT 30`),
          runWarehouseQuerySafe(`SELECT metric_date, total_sessions, total_gb_transferred, avg_duration_seconds, proxy_session_pct FROM ops.agg_ops_daily ORDER BY metric_date DESC LIMIT 30`),
          runWarehouseQuerySafe(`
            WITH failed_runs AS (
              SELECT
                run_status,
                organization_id,
                project_id,
                duration_seconds
              FROM core.fct_browser_sessions
              WHERE run_ts_start >= current_date - interval '14 days'
                AND (
                  COALESCE(is_successful, FALSE) = FALSE
                  OR lower(COALESCE(run_status, '')) IN ('failed', 'timeout', 'error')
                )
            )
            SELECT
              CASE
                WHEN lower(COALESCE(run_status, '')) IN ('timeout', 'network_error', 'capacity_exceeded') THEN 'BrowserBase'
                WHEN lower(COALESCE(run_status, '')) IN ('failed', 'selector_error', 'interaction_error', 'navigation_error') THEN 'Stagehand'
                ELSE 'Director'
              END AS owner,
              COALESCE(run_status, 'unknown') AS failure_type,
              COUNT(*) AS failed_runs,
              COUNT(DISTINCT organization_id) AS affected_orgs,
              COUNT(DISTINCT project_id) AS affected_projects,
              ROUND(AVG(duration_seconds), 1) AS avg_duration_seconds,
              ROUND(COUNT(*) * (1 + 0.35 * COUNT(DISTINCT organization_id)), 1) AS impact_score,
              CASE
                WHEN lower(COALESCE(run_status, '')) = 'timeout' THEN 'Tighten timeout defaults and improve retry backoff.'
                WHEN lower(COALESCE(run_status, '')) = 'failed' THEN 'Investigate top failing selectors and fallback strategies.'
                WHEN lower(COALESCE(run_status, '')) = 'running' THEN 'Audit stuck executions and queue handoff guards.'
                ELSE 'Inspect traces and route to owning team.'
              END AS recommended_action
            FROM failed_runs
            GROUP BY 1, 2
            ORDER BY impact_score DESC, failed_runs DESC
            LIMIT 12
          `),
        ]);

        const row = kpiRows[0] || {};
        setKpi({
          sessions_7d: num(row.sessions_7d),
          sessions_prev_7d: num(row.sessions_prev_7d),
          success_rate_7d: num(row.success_rate_7d),
          success_rate_prev_7d: num(row.success_rate_prev_7d),
          failed_runs_7d: num(row.failed_runs_7d),
          failed_runs_prev_7d: num(row.failed_runs_prev_7d),
          active_orgs_7d: num(row.active_orgs_7d),
          active_orgs_prev_7d: num(row.active_orgs_prev_7d),
          avg_duration_7d: num(row.avg_duration_7d),
          avg_duration_prev_7d: num(row.avg_duration_prev_7d),
          proxy_adoption_7d: num(row.proxy_adoption_7d),
          proxy_adoption_prev_7d: num(row.proxy_adoption_prev_7d),
        });

        setDailyRows(
          daily.map((item) => ({
            metric_date: String(item.metric_date ?? ''),
            total_sessions: num(item.total_sessions),
            success_rate_pct: num(item.success_rate_pct),
            avg_duration_seconds: num(item.avg_duration_seconds),
            proxy_adoption_pct: num(item.proxy_adoption_pct),
            stealth_adoption_pct: num(item.stealth_adoption_pct),
          })),
        );

        setOpsRows(
          ops.map((item) => ({
            metric_date: String(item.metric_date ?? ''),
            total_sessions: num(item.total_sessions),
            total_gb_transferred: num(item.total_gb_transferred),
            avg_duration_seconds: num(item.avg_duration_seconds),
            proxy_session_pct: num(item.proxy_session_pct),
          })),
        );

        setFailureQueue(
          failures.map((item) => ({
            owner: String(item.owner ?? ''),
            failure_type: String(item.failure_type ?? ''),
            failed_runs: num(item.failed_runs),
            affected_orgs: num(item.affected_orgs),
            affected_projects: num(item.affected_projects),
            avg_duration_seconds: num(item.avg_duration_seconds),
            impact_score: num(item.impact_score),
            recommended_action: String(item.recommended_action ?? ''),
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load product terminal');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <TerminalShell active="product" title="Product Lead Terminal" subtitle="Reliability, session quality, and feature adoption in one surface.">
        <LoadingState title="Loading product terminal" description="Compiling reliability and product adoption signals." />
      </TerminalShell>
    );
  }

  if (error || !kpi) {
    return (
      <TerminalShell active="product" title="Product Lead Terminal" subtitle="Reliability, session quality, and feature adoption in one surface.">
        <EmptyState title="Product terminal unavailable" description={error || 'No KPI rows.'} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell active="product" title="Product Lead Terminal" subtitle="Reliability, session quality, and feature adoption in one surface.">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Badge variant="accent">Product + Ops</Badge>
        </div>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Workflow Success (7d)" value={pct(kpi.success_rate_7d)} trend={kpi.success_rate_7d >= kpi.success_rate_prev_7d ? 'up' : 'down'} />
          <StatTile label="Failed Runs (7d)" value={`${kpi.failed_runs_7d.toLocaleString()}`} trend={kpi.failed_runs_7d <= kpi.failed_runs_prev_7d ? 'up' : 'down'} />
          <StatTile label="Active Orgs (7d)" value={`${kpi.active_orgs_7d.toLocaleString()}`} trend={kpi.active_orgs_7d >= kpi.active_orgs_prev_7d ? 'up' : 'down'} />
          <StatTile label="Sessions (7d)" value={`${kpi.sessions_7d.toLocaleString()}`} trend={kpi.sessions_7d >= kpi.sessions_prev_7d ? 'up' : 'down'} />
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Avg Duration (7d)" value={`${kpi.avg_duration_7d.toFixed(1)}s`} trend={kpi.avg_duration_7d <= kpi.avg_duration_prev_7d ? 'up' : 'down'} />
          <StatTile label="Proxy Adoption (7d)" value={pct(kpi.proxy_adoption_7d)} trend={kpi.proxy_adoption_7d >= kpi.proxy_adoption_prev_7d ? 'up' : 'down'} />
          <StatTile label="Reliability Health" value={kpi.success_rate_7d >= 95 ? 'Green' : kpi.success_rate_7d >= 85 ? 'Yellow' : 'Red'} trend={kpi.success_rate_7d >= kpi.success_rate_prev_7d ? 'up' : 'down'} />
          <StatTile label="Run Quality Delta" value={delta(kpi.success_rate_7d, kpi.success_rate_prev_7d)} trend={kpi.success_rate_7d >= kpi.success_rate_prev_7d ? 'up' : 'down'} />
        </section>

        <Card variant="elevated" className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content-primary">What Changed (7d vs prior 7d)</h2>
            <Badge variant="warning">Action Queue Driver</Badge>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded border border-border bg-surface-primary px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-content-tertiary">Success Rate Delta</p>
              <p className="mt-1 text-sm font-semibold text-content-primary">{delta(kpi.success_rate_7d, kpi.success_rate_prev_7d)} pts</p>
            </div>
            <div className="rounded border border-border bg-surface-primary px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-content-tertiary">Failed Runs Delta</p>
              <p className="mt-1 text-sm font-semibold text-content-primary">{deltaInt(kpi.failed_runs_7d, kpi.failed_runs_prev_7d)}</p>
            </div>
            <div className="rounded border border-border bg-surface-primary px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-content-tertiary">Active Orgs Delta</p>
              <p className="mt-1 text-sm font-semibold text-content-primary">{deltaInt(kpi.active_orgs_7d, kpi.active_orgs_prev_7d)}</p>
            </div>
            <div className="rounded border border-border bg-surface-primary px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-content-tertiary">Avg Duration Delta</p>
              <p className="mt-1 text-sm font-semibold text-content-primary">{delta(kpi.avg_duration_7d, kpi.avg_duration_prev_7d)}s</p>
            </div>
          </div>
        </Card>

        <Card variant="elevated" className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content-primary">Failure Intelligence Queue (14d)</h2>
            <Badge variant="warning">Ranked by Impact Score</Badge>
          </div>
          <DataTable<FailureQueueRow>
            columns={[
              { key: 'owner', header: 'Owner' },
              { key: 'failure_type', header: 'Failure Type' },
              { key: 'failed_runs', header: 'Failed Runs', align: 'right' },
              { key: 'affected_orgs', header: 'Affected Orgs', align: 'right' },
              { key: 'affected_projects', header: 'Projects', align: 'right' },
              { key: 'impact_score', header: 'Impact Score', align: 'right', render: (row) => row.impact_score.toFixed(1) },
              { key: 'recommended_action', header: 'Recommended Action' },
            ]}
            rows={failureQueue}
            emptyLabel="No failed-run clusters in the last 14 days."
          />
        </Card>

        <Card variant="elevated" className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-content-primary">Product Daily Signals</h2>
          <DataTable<DailyRow>
            columns={[
              { key: 'metric_date', header: 'Date' },
              { key: 'total_sessions', header: 'Sessions', align: 'right' },
              { key: 'success_rate_pct', header: 'Success %', align: 'right', render: (row) => pct(row.success_rate_pct) },
              { key: 'avg_duration_seconds', header: 'Avg Duration (s)', align: 'right', render: (row) => row.avg_duration_seconds.toFixed(1) },
              { key: 'proxy_adoption_pct', header: 'Proxy %', align: 'right', render: (row) => pct(row.proxy_adoption_pct) },
              { key: 'stealth_adoption_pct', header: 'Stealth %', align: 'right', render: (row) => pct(row.stealth_adoption_pct) },
            ]}
            rows={dailyRows}
            emptyLabel="No product_daily rows available."
          />
        </Card>

        <Card variant="elevated" className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-content-primary">Ops Throughput Signals</h2>
          <DataTable<OpsRow>
            columns={[
              { key: 'metric_date', header: 'Date' },
              { key: 'total_sessions', header: 'Sessions', align: 'right' },
              { key: 'total_gb_transferred', header: 'GB Transferred', align: 'right', render: (row) => row.total_gb_transferred.toFixed(2) },
              { key: 'avg_duration_seconds', header: 'Avg Duration (s)', align: 'right', render: (row) => row.avg_duration_seconds.toFixed(1) },
              { key: 'proxy_session_pct', header: 'Proxy Session %', align: 'right', render: (row) => pct(row.proxy_session_pct) },
            ]}
            rows={opsRows}
            emptyLabel="No ops_daily rows available."
          />
        </Card>
      </div>
    </TerminalShell>
  );
}
