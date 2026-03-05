'use client';

import { useEffect, useState } from 'react';
import {
  AppShell,
  Badge,
  Card,
  DataTable,
  EmptyState,
  LoadingState,
  PageHeader,
  SidebarNav,
  StatTile,
} from '@/components/ui';
import { num, pct, runWarehouseQuery, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface OpsSnapshot {
  successRate: number;
  timeoutRate: number;
  errorsPer1k: number;
  mrr: number;
  openPipeline: number;
}

interface RiskItem {
  source: string;
  metric: string;
  value: string;
  status: 'green' | 'yellow' | 'red';
}

export default function OpsBriefPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [riskRows, setRiskRows] = useState<RiskItem[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [engRows, mrrRows, pipeRows, growthRows] = await Promise.all([
          runWarehouseQuery(`SELECT avg_success_rate_pct_30d, avg_timeout_rate_pct_30d, avg_errors_per_1k_sessions_30d FROM eng.kpi_engineering ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuerySafe(`SELECT total_mrr_usd FROM fin.snap_mrr ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuery(`SELECT open_pipeline_usd FROM gtm.snap_pipeline_daily ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuerySafe(`SELECT avg_activation_rate_7d_pct FROM gtm.kpi_growth ORDER BY as_of_date DESC LIMIT 1`),
        ]);

        const eng = engRows[0] || {};
        const mrr = mrrRows[0] || {};
        const pipe = pipeRows[0] || {};
        const growth = growthRows[0] || {};

        const successRate = num(eng.avg_success_rate_pct_30d);
        const timeoutRate = num(eng.avg_timeout_rate_pct_30d);
        const errorsPer1k = num(eng.avg_errors_per_1k_sessions_30d);
        const activation = num(growth.avg_activation_rate_7d_pct);

        setSnapshot({
          successRate,
          timeoutRate,
          errorsPer1k,
          mrr: num(mrr.total_mrr_usd),
          openPipeline: num(pipe.open_pipeline_usd),
        });

        const checkRows: RiskItem[] = [
          {
            source: 'eng.kpi_engineering',
            metric: '30d success rate',
            value: pct(successRate),
            status: successRate >= 95 ? 'green' : successRate >= 90 ? 'yellow' : 'red',
          },
          {
            source: 'eng.kpi_engineering',
            metric: '30d timeout rate',
            value: pct(timeoutRate),
            status: timeoutRate <= 2 ? 'green' : timeoutRate <= 4 ? 'yellow' : 'red',
          },
          {
            source: 'eng.kpi_engineering',
            metric: '30d errors per 1k sessions',
            value: errorsPer1k.toFixed(2),
            status: errorsPer1k <= 8 ? 'green' : errorsPer1k <= 15 ? 'yellow' : 'red',
          },
          {
            source: 'gtm.kpi_growth',
            metric: '7d activation rate',
            value: pct(activation),
            status: activation >= 40 ? 'green' : activation >= 25 ? 'yellow' : 'red',
          },
          {
            source: 'fin.snap_mrr',
            metric: 'Total MRR',
            value: usd(num(mrr.total_mrr_usd)),
            status: num(mrr.total_mrr_usd) > 0 ? 'green' : 'yellow',
          },
          {
            source: 'gtm.snap_pipeline_daily',
            metric: 'Open pipeline',
            value: usd(num(pipe.open_pipeline_usd)),
            status: num(pipe.open_pipeline_usd) > 0 ? 'green' : 'yellow',
          },
        ];

        setRiskRows(checkRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ops brief');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const navItems = [
    { href: '/exec', label: 'Executive', active: false },
    { href: '/gtm-terminal', label: 'GTM Terminal', active: false },
    { href: '/product-terminal', label: 'Product', active: false },
    { href: '/ops-brief', label: 'Ops Brief', active: true },
    { href: '/metrics-catalog', label: 'Metrics Catalog', active: false },
  ];

  if (loading) {
    return (
      <AppShell sidebar={<SidebarNav title="Role Views" items={navItems} />}>
        <LoadingState title="Loading ops brief" description="Building weekly operating summary and owner actions." />
      </AppShell>
    );
  }

  if (error || !snapshot) {
    return (
      <AppShell sidebar={<SidebarNav title="Role Views" items={navItems} />}>
        <EmptyState title="Ops brief unavailable" description={error || 'No snapshot rows.'} actionLabel="Retry" onAction={() => window.location.reload()} />
      </AppShell>
    );
  }

  return (
    <AppShell sidebar={<SidebarNav title="Role Views" items={navItems} />}>
      <div className="space-y-4">
        <PageHeader
          title="Chief of Staff Ops Brief"
          subtitle="Single weekly review: health, owners, and next actions."
          actions={<Badge variant="warning">Weekly operating cadence</Badge>}
        />

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Success Rate" value={pct(snapshot.successRate)} trend={snapshot.successRate >= 95 ? 'up' : 'down'} />
          <StatTile label="Timeout Rate" value={pct(snapshot.timeoutRate)} trend={snapshot.timeoutRate <= 2 ? 'up' : 'down'} />
          <StatTile label="Errors / 1k" value={snapshot.errorsPer1k.toFixed(2)} trend={snapshot.errorsPer1k < 10 ? 'up' : 'down'} />
          <StatTile label="MRR" value={usd(snapshot.mrr)} trend="up" />
          <StatTile label="Open Pipeline" value={usd(snapshot.openPipeline)} trend="up" />
        </section>

        <Card variant="elevated" className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-content-primary">Operating Control Checks</h2>
          <DataTable<RiskItem>
            columns={[
              { key: 'source', header: 'Source' },
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
            ]}
            rows={riskRows}
          />
        </Card>
      </div>
    </AppShell>
  );
}
