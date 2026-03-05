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

interface Snapshot {
  mrr: number;
  pipeline: number;
  wonRevenue: number;
  winRate: number;
  totalSessions: number;
  successRate: number;
  newOrgs: number;
  cac: number | null;
  ltv: number | null;
}

interface TrendRow {
  month: string;
  revenue: number;
  spend: number;
  roas: number | null;
}

export default function ExecPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [trendRows, setTrendRows] = useState<TrendRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [mrrRows, pipeRows, kpiRows, unitRows] = await Promise.all([
          runWarehouseQuerySafe(`SELECT total_mrr_usd FROM fin.snap_mrr ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuery(`SELECT open_pipeline_usd, won_revenue_usd, opportunity_win_rate_pct FROM gtm.snap_pipeline_daily ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuery(`SELECT total_sessions, success_rate_pct, new_organizations FROM core.daily_kpis ORDER BY date DESC LIMIT 1`),
          runWarehouseQuerySafe(`SELECT metric_month, realized_revenue_usd, campaign_spend_usd, pipeline_roas, cac_usd, ltv_proxy_usd FROM gtm.agg_unit_economics_monthly ORDER BY metric_month DESC LIMIT 12`),
        ]);

        const mrr = num(mrrRows[0]?.total_mrr_usd);
        const pipe = pipeRows[0] || {};
        const kpi = kpiRows[0] || {};
        const latestUnit = unitRows[0] || {};

        setSnapshot({
          mrr,
          pipeline: num(pipe.open_pipeline_usd),
          wonRevenue: num(pipe.won_revenue_usd),
          winRate: num(pipe.opportunity_win_rate_pct),
          totalSessions: num(kpi.total_sessions),
          successRate: num(kpi.success_rate_pct),
          newOrgs: num(kpi.new_organizations),
          cac: latestUnit.cac_usd == null ? null : num(latestUnit.cac_usd),
          ltv: latestUnit.ltv_proxy_usd == null ? null : num(latestUnit.ltv_proxy_usd),
        });

        setTrendRows(
          unitRows.map((row) => ({
            month: String(row.metric_month ?? ''),
            revenue: num(row.realized_revenue_usd),
            spend: num(row.campaign_spend_usd),
            roas: row.pipeline_roas == null ? null : num(row.pipeline_roas),
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load executive view');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const navItems = [
    { href: '/exec', label: 'Executive', active: true },
    { href: '/gtm-terminal', label: 'GTM Terminal', active: false },
    { href: '/product-terminal', label: 'Product', active: false },
    { href: '/ops-brief', label: 'Ops Brief', active: false },
    { href: '/metrics-catalog', label: 'Metrics Catalog', active: false },
  ];

  if (loading) {
    return (
      <AppShell sidebar={<SidebarNav title="Role Views" items={navItems} />}>
        <LoadingState title="Loading executive view" description="Compiling revenue, pipeline, and operating health." />
      </AppShell>
    );
  }

  if (error || !snapshot) {
    return (
      <AppShell sidebar={<SidebarNav title="Role Views" items={navItems} />}>
        <EmptyState title="Executive view unavailable" description={error || 'No snapshot found.'} actionLabel="Retry" onAction={() => window.location.reload()} />
      </AppShell>
    );
  }

  return (
    <AppShell sidebar={<SidebarNav title="Role Views" items={navItems} />}>
      <div className="space-y-4">
        <PageHeader
          title="Executive Command"
          subtitle="CEO-level daily truth: revenue, conversion, reliability, and efficiency."
          actions={<Badge variant="accent">Live from warehouse</Badge>}
        />

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="MRR" value={usd(snapshot.mrr)} trend="up" />
          <StatTile label="Open Pipeline" value={usd(snapshot.pipeline)} trend="up" />
          <StatTile label="Win Rate" value={pct(snapshot.winRate)} trend="up" />
          <StatTile label="Success Rate" value={pct(snapshot.successRate)} trend={snapshot.successRate >= 90 ? 'up' : 'down'} />
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Won Revenue" value={usd(snapshot.wonRevenue)} trend="up" />
          <StatTile label="Daily Sessions" value={`${snapshot.totalSessions}`} trend="neutral" />
          <StatTile label="New Orgs" value={`${snapshot.newOrgs}`} trend={snapshot.newOrgs > 0 ? 'up' : 'neutral'} />
          <StatTile
            label="LTV:CAC (Proxy)"
            value={snapshot.ltv && snapshot.cac && snapshot.cac > 0 ? (snapshot.ltv / snapshot.cac).toFixed(2) : 'n/a'}
            trend={snapshot.ltv && snapshot.cac && snapshot.ltv > snapshot.cac * 3 ? 'up' : 'neutral'}
          />
        </section>

        <Card variant="elevated" className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content-primary">Unit Economics Trend</h2>
            <Badge variant="neutral">Last 12 months</Badge>
          </div>
          <DataTable<TrendRow>
            columns={[
              { key: 'month', header: 'Month' },
              { key: 'revenue', header: 'Revenue', align: 'right', render: (row) => usd(row.revenue) },
              { key: 'spend', header: 'Campaign Spend', align: 'right', render: (row) => usd(row.spend) },
              { key: 'roas', header: 'Pipeline ROAS', align: 'right', render: (row) => (row.roas == null ? 'n/a' : row.roas.toFixed(2)) },
            ]}
            rows={trendRows}
            emptyLabel="No unit economics rows available yet."
          />
        </Card>
      </div>
    </AppShell>
  );
}
