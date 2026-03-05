'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, DataTable, EmptyState, LoadingState, StatTile } from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import OrganizationDrillPanel from '@/components/terminal/OrganizationDrillPanel';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface Snapshot {
  mrr: number | null;
  pipeline: number | null;
  wonRevenue: number | null;
  successRate: number | null;
  sessions30d: number | null;
  budgetUtilization: number | null;
}

interface TriggerRow {
  function_name: string;
  signal: string;
  value: string;
  action: string;
  href: string;
}

interface OrganizationRow {
  organization_id: string;
  organization_name: string;
  realized_revenue_usd: number;
  collection_rate_pct: number;
  risk_score: number | null;
}

export default function ExecutiveTerminalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrganizationRow[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  const fmtUsd = (value: number | null) => (value == null ? 'n/a' : usd(value));
  const fmtPct = (value: number | null) => (value == null ? 'n/a' : pct(value));
  const fmtInt = (value: number | null) => (value == null ? 'n/a' : value.toLocaleString());

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [mrrRows, pipelineRows, productRows, budgetRows, growthRows, financeRows, riskRows] = await Promise.all([
          runWarehouseQuerySafe(`SELECT total_mrr_usd FROM fin.snap_mrr ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuerySafe(`SELECT open_pipeline_usd, won_revenue_usd FROM gtm.snap_pipeline_daily ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuerySafe(`SELECT sessions_30d, avg_success_rate_pct_30d FROM pro.kpi_product ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuerySafe(`SELECT budget_utilization_ratio FROM fin.agg_budget_vs_actual_monthly ORDER BY budget_month DESC LIMIT 1`),
          runWarehouseQuerySafe(`SELECT avg_activation_rate_7d_pct FROM gtm.kpi_growth ORDER BY as_of_date DESC LIMIT 1`),
          runWarehouseQuerySafe(`
            SELECT organization_id, organization_name, realized_revenue_usd, collection_rate_pct
            FROM fin.agg_revenue_monthly
            WHERE revenue_month = (SELECT MAX(revenue_month) FROM fin.agg_revenue_monthly)
            ORDER BY realized_revenue_usd DESC
            LIMIT 100
          `),
          runWarehouseQuerySafe(`
            SELECT organization_id, signal_score
            FROM gtm.signal_trial_conversion_risk_daily
            ORDER BY triggered_at DESC
            LIMIT 500
          `),
        ]);

        const mrr = mrrRows[0]?.total_mrr_usd == null ? null : num(mrrRows[0]?.total_mrr_usd);
        const pipeline = pipelineRows[0]?.open_pipeline_usd == null ? null : num(pipelineRows[0]?.open_pipeline_usd);
        const wonRevenue = pipelineRows[0]?.won_revenue_usd == null ? null : num(pipelineRows[0]?.won_revenue_usd);
        const successRate = productRows[0]?.avg_success_rate_pct_30d == null ? null : num(productRows[0]?.avg_success_rate_pct_30d);
        const sessions30d = productRows[0]?.sessions_30d == null ? null : num(productRows[0]?.sessions_30d);
        const budgetUtilization = budgetRows[0]?.budget_utilization_ratio == null ? null : num(budgetRows[0]?.budget_utilization_ratio);
        const activation = growthRows[0]?.avg_activation_rate_7d_pct == null ? null : num(growthRows[0]?.avg_activation_rate_7d_pct);

        setSnapshot({
          mrr,
          pipeline,
          wonRevenue,
          successRate,
          sessions30d,
          budgetUtilization,
        });

        setTriggers([
          {
            function_name: 'GTM',
            signal: 'Open pipeline',
            value: fmtUsd(pipeline),
            action: 'Re-rank campaign spend vs win rate',
            href: '/terminal/gtm',
          },
          {
            function_name: 'Growth',
            signal: 'Activation 7d',
            value: fmtPct(activation),
            action: 'Prioritize urgent trial-rescue tasks',
            href: '/terminal/growth',
          },
          {
            function_name: 'Product',
            signal: 'Success rate 30d',
            value: fmtPct(successRate),
            action: 'Escalate reliability owners on drops',
            href: '/terminal/product',
          },
          {
            function_name: 'Finance',
            signal: 'Budget utilization',
            value: fmtPct(budgetUtilization),
            action: 'Cut overrun sources, protect gross margin',
            href: '/terminal/finance',
          },
          {
            function_name: 'Ops',
            signal: 'Sessions 30d',
            value: fmtInt(sessions30d),
            action: 'Watch load and timeout envelope',
            href: '/terminal/ops',
          },
        ]);

        const latestRiskByOrg = new Map<string, number>();
        for (const row of riskRows) {
          const organizationId = String(row.organization_id ?? '');
          if (!organizationId || latestRiskByOrg.has(organizationId)) continue;
          latestRiskByOrg.set(organizationId, num(row.signal_score) * 100);
        }

        setOrgRows(
          financeRows
            .map((row) => {
              const organizationId = String(row.organization_id ?? '');
              return {
                organization_id: organizationId,
                organization_name: String(row.organization_name ?? ''),
                realized_revenue_usd: num(row.realized_revenue_usd),
                collection_rate_pct: num(row.collection_rate_pct),
                risk_score: latestRiskByOrg.get(organizationId) ?? null,
              };
            })
            .filter((row) => row.organization_id.length > 0)
            .slice(0, 20),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load executive terminal');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <TerminalShell active="executive" title="Executive Terminal" subtitle="Cross-functional control room for the entire business.">
        <LoadingState title="Loading executive terminal" description="Compiling finance, GTM, growth, product, and ops signals." />
      </TerminalShell>
    );
  }

  if (error || !snapshot) {
    return (
      <TerminalShell active="executive" title="Executive Terminal" subtitle="Cross-functional control room for the entire business.">
        <EmptyState title="Executive terminal unavailable" description={error || 'No data found'} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell active="executive" title="Executive Terminal" subtitle="Cross-functional control room for the entire business.">
      <div className="space-y-3">
        {selectedOrganizationId ? (
          <OrganizationDrillPanel organizationId={selectedOrganizationId} onClose={() => setSelectedOrganizationId(null)} />
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="MRR" value={fmtUsd(snapshot.mrr)} trend="up" />
          <StatTile label="Open Pipeline" value={fmtUsd(snapshot.pipeline)} trend="up" />
          <StatTile label="Won Revenue" value={fmtUsd(snapshot.wonRevenue)} trend="up" />
          <StatTile label="Success 30d" value={fmtPct(snapshot.successRate)} trend={snapshot.successRate != null && snapshot.successRate >= 95 ? 'up' : 'down'} />
          <StatTile label="Sessions 30d" value={fmtInt(snapshot.sessions30d)} trend="neutral" />
          <StatTile label="Budget Utilization" value={fmtPct(snapshot.budgetUtilization)} trend={snapshot.budgetUtilization != null && snapshot.budgetUtilization <= 100 ? 'up' : 'down'} />
        </section>

        <Card variant="elevated" className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content-primary">Operator Triggers</h2>
            <Badge variant="warning">Prioritize by actionability</Badge>
          </div>
          <DataTable<TriggerRow>
            columns={[
              { key: 'function_name', header: 'Function' },
              { key: 'signal', header: 'Signal' },
              { key: 'value', header: 'Value', align: 'right' },
              { key: 'action', header: 'Recommended Action' },
              {
                key: 'drill',
                header: 'Drill',
                render: (row) => (
                  <Link href={row.href} className="text-accent hover:underline">
                    Open
                  </Link>
                ),
              },
            ]}
            rows={triggers}
            emptyLabel="No trigger rows"
          />
        </Card>

        <Card variant="elevated" className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-content-primary">Top Organizations</h2>
          <DataTable<OrganizationRow>
            columns={[
              { key: 'organization_name', header: 'Organization' },
              { key: 'realized_revenue_usd', header: 'Realized', align: 'right', render: (row) => usd(row.realized_revenue_usd) },
              { key: 'collection_rate_pct', header: 'Collect %', align: 'right', render: (row) => pct(row.collection_rate_pct) },
              { key: 'risk_score', header: 'Risk', align: 'right', render: (row) => (row.risk_score == null ? 'n/a' : row.risk_score.toFixed(0)) },
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
            rows={orgRows}
            emptyLabel="No organization rows"
          />
        </Card>
      </div>
    </TerminalShell>
  );
}
