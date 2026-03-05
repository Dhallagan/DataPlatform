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
} from '@/components/ui';
import { num, runWarehouseQuerySafe } from '@/lib/warehouse';

interface SourceHealthRow {
  dataset: string;
  freshness: string;
  row_count: number;
}

function fmtFreshness(value: unknown): string {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : 'n/a';
}

export default function MetricsCatalogPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SourceHealthRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [
          mrr,
          monthlyRevenue,
          pipeline,
          growthDaily,
          riskDaily,
          queue,
          campaign,
          productDaily,
          productKpis,
          opsDaily,
          opsKpis,
          coreDaily,
          growthKpis,
          engKpis,
        ] = await Promise.all([
          runWarehouseQuerySafe(`SELECT MAX(as_of_date) AS freshness, COUNT(*) AS row_count FROM fin.snap_mrr`),
          runWarehouseQuerySafe(`SELECT MAX(revenue_month) AS freshness, COUNT(*) AS row_count FROM fin.agg_revenue_monthly`),
          runWarehouseQuerySafe(`SELECT MAX(as_of_date) AS freshness, COUNT(*) AS row_count FROM gtm.snap_pipeline_daily`),
          runWarehouseQuerySafe(`SELECT MAX(metric_date) AS freshness, COUNT(*) AS row_count FROM gtm.agg_growth_daily`),
          runWarehouseQuerySafe(`SELECT MAX(triggered_at) AS freshness, COUNT(*) AS row_count FROM gtm.signal_trial_conversion_risk_daily`),
          runWarehouseQuerySafe(`SELECT MAX(created_at) AS freshness, COUNT(*) AS row_count FROM gtm.growth_task_queue`),
          runWarehouseQuerySafe(`SELECT MAX(metric_month) AS freshness, COUNT(*) AS row_count FROM gtm.agg_campaign_channel_monthly`),
          runWarehouseQuerySafe(`SELECT MAX(metric_date) AS freshness, COUNT(*) AS row_count FROM pro.agg_product_daily`),
          runWarehouseQuerySafe(`SELECT MAX(as_of_date) AS freshness, COUNT(*) AS row_count FROM pro.kpi_product`),
          runWarehouseQuerySafe(`SELECT MAX(metric_date) AS freshness, COUNT(*) AS row_count FROM ops.agg_ops_daily`),
          runWarehouseQuerySafe(`SELECT MAX(as_of_date) AS freshness, COUNT(*) AS row_count FROM ops.kpi_ops`),
          runWarehouseQuerySafe(`SELECT MAX(date) AS freshness, COUNT(*) AS row_count FROM core.daily_kpis`),
          runWarehouseQuerySafe(`SELECT MAX(as_of_date) AS freshness, COUNT(*) AS row_count FROM gtm.kpi_growth`),
          runWarehouseQuerySafe(`SELECT MAX(as_of_date) AS freshness, COUNT(*) AS row_count FROM eng.kpi_engineering`),
        ]);

        const mapped: SourceHealthRow[] = [
          { dataset: 'fin.snap_mrr', freshness: fmtFreshness(mrr[0]?.freshness), row_count: num(mrr[0]?.row_count) },
          { dataset: 'fin.agg_revenue_monthly', freshness: fmtFreshness(monthlyRevenue[0]?.freshness), row_count: num(monthlyRevenue[0]?.row_count) },
          { dataset: 'gtm.snap_pipeline_daily', freshness: fmtFreshness(pipeline[0]?.freshness), row_count: num(pipeline[0]?.row_count) },
          { dataset: 'gtm.agg_growth_daily', freshness: fmtFreshness(growthDaily[0]?.freshness), row_count: num(growthDaily[0]?.row_count) },
          { dataset: 'gtm.signal_trial_conversion_risk_daily', freshness: fmtFreshness(riskDaily[0]?.freshness), row_count: num(riskDaily[0]?.row_count) },
          { dataset: 'gtm.growth_task_queue', freshness: fmtFreshness(queue[0]?.freshness), row_count: num(queue[0]?.row_count) },
          { dataset: 'gtm.agg_campaign_channel_monthly', freshness: fmtFreshness(campaign[0]?.freshness), row_count: num(campaign[0]?.row_count) },
          { dataset: 'pro.agg_product_daily', freshness: fmtFreshness(productDaily[0]?.freshness), row_count: num(productDaily[0]?.row_count) },
          { dataset: 'pro.kpi_product', freshness: fmtFreshness(productKpis[0]?.freshness), row_count: num(productKpis[0]?.row_count) },
          { dataset: 'ops.agg_ops_daily', freshness: fmtFreshness(opsDaily[0]?.freshness), row_count: num(opsDaily[0]?.row_count) },
          { dataset: 'ops.kpi_ops', freshness: fmtFreshness(opsKpis[0]?.freshness), row_count: num(opsKpis[0]?.row_count) },
          { dataset: 'core.daily_kpis', freshness: fmtFreshness(coreDaily[0]?.freshness), row_count: num(coreDaily[0]?.row_count) },
          { dataset: 'gtm.kpi_growth', freshness: fmtFreshness(growthKpis[0]?.freshness), row_count: num(growthKpis[0]?.row_count) },
          { dataset: 'eng.kpi_engineering', freshness: fmtFreshness(engKpis[0]?.freshness), row_count: num(engKpis[0]?.row_count) },
        ].sort((a, b) => a.dataset.localeCompare(b.dataset));

        setRows(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load metrics catalog');
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
    { href: '/ops-brief', label: 'Ops Brief', active: false },
    { href: '/metrics-catalog', label: 'Metrics Catalog', active: true },
  ];

  if (loading) {
    return (
      <AppShell sidebar={<SidebarNav title="Role Views" items={navItems} />}>
        <LoadingState title="Loading metrics catalog" description="Checking source freshness and row volume." />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell sidebar={<SidebarNav title="Role Views" items={navItems} />}>
        <EmptyState title="Metrics catalog unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </AppShell>
    );
  }

  const healthySources = rows.filter((row) => row.row_count > 0 && row.freshness !== 'n/a').length;

  return (
    <AppShell sidebar={<SidebarNav title="Role Views" items={navItems} />}>
      <div className="space-y-4">
        <PageHeader
          title="Metrics Catalog"
          subtitle="Inventory of warehouse datasets powering GTM terminal and role pages."
          actions={<Badge variant="accent">{healthySources}/{rows.length} active sources</Badge>}
        />

        <Card variant="elevated" className="p-4">
          <DataTable<SourceHealthRow>
            columns={[
              { key: 'dataset', header: 'Dataset' },
              { key: 'freshness', header: 'Latest Row' },
              { key: 'row_count', header: 'Rows', align: 'right' },
            ]}
            rows={rows}
            emptyLabel="No dataset health rows available."
          />
        </Card>
      </div>
    </AppShell>
  );
}
