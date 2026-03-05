'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card, DataTable, EmptyState, LoadingState, StatTile } from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import OrganizationDrillPanel from '@/components/terminal/OrganizationDrillPanel';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface OpsKpi {
  successRate: number | null;
  timeoutRate: number | null;
  errorsPer1k: number | null;
  proxyPct: number | null;
  avgDuration: number | null;
}

interface OpsDailyRow {
  metric_date: string;
  total_sessions: number;
  total_gb_transferred: number;
  avg_duration_seconds: number;
  proxy_session_pct: number;
}

interface CheckRow {
  metric: string;
  value: string;
  status: 'green' | 'yellow' | 'red';
  play: string;
}

interface ImpactedOrgRow {
  organization_id: string;
  organization_name: string;
  total_runs_7d: number;
  success_rate_7d: number;
  signal_score: number;
}

export default function OpsTerminalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpi, setKpi] = useState<OpsKpi | null>(null);
  const [opsRows, setOpsRows] = useState<OpsDailyRow[]>([]);
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [orgRows, setOrgRows] = useState<ImpactedOrgRow[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  const fmtPct = (value: number | null) => (value == null ? 'n/a' : pct(value));
  const fmtNum = (value: number | null) => (value == null ? 'n/a' : value.toFixed(2));

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [engRows, opsDailyRows, financeRows, riskRows] = await Promise.all([
          runWarehouseQuerySafe(`
            SELECT avg_success_rate_pct_30d, avg_timeout_rate_pct_30d, avg_errors_per_1k_sessions_30d
            FROM eng.kpi_engineering
            ORDER BY as_of_date DESC
            LIMIT 1
          `),
          runWarehouseQuerySafe(`
            SELECT metric_date, total_sessions, total_gb_transferred, avg_duration_seconds, proxy_session_pct
            FROM ops.agg_ops_daily
            ORDER BY metric_date DESC
            LIMIT 30
          `),
          runWarehouseQuerySafe(`SELECT total_mrr_usd FROM fin.snap_mrr ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuerySafe(`
            SELECT organization_id, organization_name, total_runs_7d, success_rate_7d, signal_score
            FROM gtm.signal_trial_conversion_risk_daily
            ORDER BY signal_score DESC, total_runs_7d DESC
            LIMIT 60
          `),
        ]);

        const eng = engRows[0] || {};
        const latestOps = opsDailyRows[0] || {};

        const localKpi: OpsKpi = {
          successRate: eng.avg_success_rate_pct_30d == null ? null : num(eng.avg_success_rate_pct_30d),
          timeoutRate: eng.avg_timeout_rate_pct_30d == null ? null : num(eng.avg_timeout_rate_pct_30d),
          errorsPer1k: eng.avg_errors_per_1k_sessions_30d == null ? null : num(eng.avg_errors_per_1k_sessions_30d),
          proxyPct: latestOps.proxy_session_pct == null ? null : num(latestOps.proxy_session_pct),
          avgDuration: latestOps.avg_duration_seconds == null ? null : num(latestOps.avg_duration_seconds),
        };
        setKpi(localKpi);

        setOpsRows(
          opsDailyRows.map((row) => ({
            metric_date: String(row.metric_date ?? ''),
            total_sessions: num(row.total_sessions),
            total_gb_transferred: num(row.total_gb_transferred),
            avg_duration_seconds: num(row.avg_duration_seconds),
            proxy_session_pct: num(row.proxy_session_pct),
          })),
        );

        const mrr = num(financeRows[0]?.total_mrr_usd);
        setChecks([
          {
            metric: 'Success Rate 30d',
            value: fmtPct(localKpi.successRate),
            status: localKpi.successRate != null && localKpi.successRate >= 95 ? 'green' : localKpi.successRate != null && localKpi.successRate >= 90 ? 'yellow' : 'red',
            play: 'Escalate reliability fixes when below 90%',
          },
          {
            metric: 'Timeout Rate 30d',
            value: fmtPct(localKpi.timeoutRate),
            status: localKpi.timeoutRate != null && localKpi.timeoutRate <= 2 ? 'green' : localKpi.timeoutRate != null && localKpi.timeoutRate <= 4 ? 'yellow' : 'red',
            play: 'Tune infra/queue and throttle hotspots',
          },
          {
            metric: 'Errors per 1k',
            value: fmtNum(localKpi.errorsPer1k),
            status: localKpi.errorsPer1k != null && localKpi.errorsPer1k <= 8 ? 'green' : localKpi.errorsPer1k != null && localKpi.errorsPer1k <= 15 ? 'yellow' : 'red',
            play: 'Inspect regressions by release window',
          },
          {
            metric: 'Revenue at risk (MRR context)',
            value: usd(mrr),
            status: localKpi.successRate != null && localKpi.successRate >= 95 ? 'green' : 'yellow',
            play: 'Prioritize reliability work proportional to revenue exposure',
          },
        ]);

        setOrgRows(
          riskRows.map((row) => ({
            organization_id: String(row.organization_id ?? ''),
            organization_name: String(row.organization_name ?? ''),
            total_runs_7d: num(row.total_runs_7d),
            success_rate_7d: num(row.success_rate_7d),
            signal_score: num(row.signal_score),
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load ops terminal');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <TerminalShell active="ops" title="Ops Terminal" subtitle="Reliability, throughput, and operating risk controls.">
        <LoadingState title="Loading ops terminal" description="Compiling engineering and ops reliability checks." />
      </TerminalShell>
    );
  }

  if (error || !kpi) {
    return (
      <TerminalShell active="ops" title="Ops Terminal" subtitle="Reliability, throughput, and operating risk controls.">
        <EmptyState title="Ops terminal unavailable" description={error || 'No data found'} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell active="ops" title="Ops Terminal" subtitle="Reliability, throughput, and operating risk controls.">
      <div className="space-y-3">
        {selectedOrganizationId ? (
          <OrganizationDrillPanel organizationId={selectedOrganizationId} onClose={() => setSelectedOrganizationId(null)} />
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Success 30d" value={fmtPct(kpi.successRate)} trend={kpi.successRate != null && kpi.successRate >= 95 ? 'up' : 'down'} />
          <StatTile label="Timeout 30d" value={fmtPct(kpi.timeoutRate)} trend={kpi.timeoutRate != null && kpi.timeoutRate <= 2 ? 'up' : 'down'} />
          <StatTile label="Errors / 1k" value={fmtNum(kpi.errorsPer1k)} trend={kpi.errorsPer1k != null && kpi.errorsPer1k <= 8 ? 'up' : 'down'} />
          <StatTile label="Proxy Session %" value={fmtPct(kpi.proxyPct)} trend="neutral" />
          <StatTile label="Avg Duration" value={kpi.avgDuration == null ? 'n/a' : `${kpi.avgDuration.toFixed(1)}s`} trend="neutral" />
        </section>

        <Card variant="elevated" className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content-primary">Control Checks</h2>
            <Badge variant="warning">Weekly operator review</Badge>
          </div>
          <DataTable<CheckRow>
            columns={[
              { key: 'metric', header: 'Metric' },
              { key: 'value', header: 'Value', align: 'right' },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge variant={row.status === 'green' ? 'success' : row.status === 'yellow' ? 'warning' : 'error'}>
                    {row.status}
                  </Badge>
                ),
              },
              { key: 'play', header: 'Play' },
            ]}
            rows={checks}
            emptyLabel="No checks"
          />
        </Card>

        <Card variant="elevated" className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-content-primary">Ops Daily Throughput</h2>
          <DataTable<OpsDailyRow>
            columns={[
              { key: 'metric_date', header: 'Date' },
              { key: 'total_sessions', header: 'Sessions', align: 'right' },
              { key: 'total_gb_transferred', header: 'GB', align: 'right', render: (row) => row.total_gb_transferred.toFixed(2) },
              { key: 'avg_duration_seconds', header: 'Avg Duration', align: 'right', render: (row) => row.avg_duration_seconds.toFixed(1) },
              { key: 'proxy_session_pct', header: 'Proxy %', align: 'right', render: (row) => pct(row.proxy_session_pct) },
            ]}
            rows={opsRows}
            emptyLabel="No ops daily rows"
          />
        </Card>

        <Card variant="elevated" className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-content-primary">Impacted Organizations</h2>
          <DataTable<ImpactedOrgRow>
            columns={[
              { key: 'organization_name', header: 'Organization' },
              { key: 'total_runs_7d', header: 'Runs 7d', align: 'right' },
              { key: 'success_rate_7d', header: 'Success %', align: 'right', render: (row) => pct(row.success_rate_7d * 100) },
              { key: 'signal_score', header: 'Risk', align: 'right', render: (row) => `${(row.signal_score * 100).toFixed(0)}` },
              {
                key: 'drill',
                header: 'Drill',
                render: (row) => (
                  row.organization_id
                    ? (
                      <Button size="sm" variant="ghost" onClick={() => setSelectedOrganizationId(row.organization_id)}>
                        Open
                      </Button>
                    )
                    : 'n/a'
                ),
              },
            ]}
            rows={orgRows.slice(0, 25)}
            emptyLabel="No impacted organization rows"
          />
        </Card>
      </div>
    </TerminalShell>
  );
}
