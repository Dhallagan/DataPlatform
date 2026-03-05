'use client';

import { useMemo, useState, useEffect } from 'react';
import { Badge, Button, Card, DataTable, EmptyState, LoadingState, StatTile } from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import OrganizationDrillPanel from '@/components/terminal/OrganizationDrillPanel';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface BudgetRow {
  budget_month: string;
  budget_allocated_usd: number;
  actual_spend_usd: number;
  budget_variance_usd: number;
  budget_utilization_ratio: number;
}

interface SourceRow {
  spend_month: string;
  spend_source: string;
  total_spend_usd: number;
}

interface VendorRow {
  vendor_name: string;
  total_spend_usd: number;
  organization_count: number;
}

interface OrganizationFinanceRow {
  organization_id: string;
  organization_name: string;
  realized_revenue_usd: number;
  pending_revenue_usd: number;
  collection_rate_pct: number;
}

export default function FinanceTerminalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [sourceRows, setSourceRows] = useState<SourceRow[]>([]);
  const [vendorRows, setVendorRows] = useState<VendorRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrganizationFinanceRow[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [budget, source, vendor, organizations] = await Promise.all([
          runWarehouseQuerySafe(`
            SELECT
              budget_month,
              round(sum(budget_allocated_usd), 2) AS budget_allocated_usd,
              round(sum(actual_spend_usd), 2) AS actual_spend_usd,
              round(sum(budget_variance_usd), 2) AS budget_variance_usd,
              round(100.0 * sum(actual_spend_usd) / nullif(sum(budget_allocated_usd), 0), 2) AS budget_utilization_ratio
            FROM fin.agg_budget_vs_actual_monthly
            WHERE budget_month >= date_trunc('month', current_date) - interval '5 months'
            GROUP BY 1
            ORDER BY budget_month DESC
          `),
          runWarehouseQuerySafe(`
            SELECT spend_month, spend_source, round(sum(spend_usd), 2) AS total_spend_usd
            FROM fin.agg_spend_monthly
            WHERE spend_month >= date_trunc('month', current_date) - interval '1 month'
            GROUP BY 1, 2
            ORDER BY total_spend_usd DESC
            LIMIT 25
          `),
          runWarehouseQuerySafe(`
            SELECT vendor_name, round(sum(total_spend_usd), 2) AS total_spend_usd, count(distinct organization_id) AS organization_count
            FROM fin.agg_vendor_spend_monthly
            WHERE spend_month >= date_trunc('month', current_date) - interval '1 month'
            GROUP BY 1
            ORDER BY total_spend_usd DESC
            LIMIT 25
          `),
          runWarehouseQuerySafe(`
            SELECT organization_id, organization_name, realized_revenue_usd, pending_revenue_usd, collection_rate_pct
            FROM fin.agg_revenue_monthly
            WHERE revenue_month = (SELECT MAX(revenue_month) FROM fin.agg_revenue_monthly)
            ORDER BY realized_revenue_usd DESC
            LIMIT 50
          `),
        ]);

        setBudgetRows(
          budget.map((row) => ({
            budget_month: String(row.budget_month ?? ''),
            budget_allocated_usd: num(row.budget_allocated_usd),
            actual_spend_usd: num(row.actual_spend_usd),
            budget_variance_usd: num(row.budget_variance_usd),
            budget_utilization_ratio: num(row.budget_utilization_ratio),
          })),
        );

        setSourceRows(
          source.map((row) => ({
            spend_month: String(row.spend_month ?? ''),
            spend_source: String(row.spend_source ?? ''),
            total_spend_usd: num(row.total_spend_usd),
          })),
        );

        setVendorRows(
          vendor.map((row) => ({
            vendor_name: String(row.vendor_name ?? ''),
            total_spend_usd: num(row.total_spend_usd),
            organization_count: num(row.organization_count),
          })),
        );

        setOrgRows(
          organizations.map((row) => ({
            organization_id: String(row.organization_id ?? ''),
            organization_name: String(row.organization_name ?? ''),
            realized_revenue_usd: num(row.realized_revenue_usd),
            pending_revenue_usd: num(row.pending_revenue_usd),
            collection_rate_pct: num(row.collection_rate_pct),
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load finance terminal');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const latest = budgetRows[0];
  const totalSourceSpend = useMemo(() => sourceRows.reduce((acc, row) => acc + row.total_spend_usd, 0), [sourceRows]);
  const hasSourceSpend = sourceRows.length > 0;

  const fmtUsd = (value: number | null | undefined) => (value == null ? 'n/a' : usd(value));
  const fmtPct = (value: number | null | undefined) => (value == null ? 'n/a' : pct(value));

  if (loading) {
    return (
      <TerminalShell active="finance" title="Finance Terminal" subtitle="Spend control, variance management, and concentration risk.">
        <LoadingState title="Loading finance terminal" description="Compiling budget, source, and vendor spend." />
      </TerminalShell>
    );
  }

  if (error) {
    return (
      <TerminalShell active="finance" title="Finance Terminal" subtitle="Spend control, variance management, and concentration risk.">
        <EmptyState title="Finance terminal unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell active="finance" title="Finance Terminal" subtitle="Spend control, variance management, and concentration risk.">
      <div className="space-y-3">
        {selectedOrganizationId ? (
          <OrganizationDrillPanel organizationId={selectedOrganizationId} onClose={() => setSelectedOrganizationId(null)} />
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Budget (Latest)" value={fmtUsd(latest?.budget_allocated_usd)} trend="neutral" />
          <StatTile label="Actual (Latest)" value={fmtUsd(latest?.actual_spend_usd)} trend="neutral" />
          <StatTile label="Variance (Latest)" value={fmtUsd(latest?.budget_variance_usd)} trend={latest != null && latest.budget_variance_usd >= 0 ? 'up' : 'down'} />
          <StatTile label="Utilization" value={fmtPct(latest?.budget_utilization_ratio)} trend={latest != null && latest.budget_utilization_ratio <= 100 ? 'up' : 'down'} />
          <StatTile label="Source Spend" value={hasSourceSpend ? usd(totalSourceSpend) : 'n/a'} trend="neutral" />
        </section>

        <Card variant="elevated" className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-content-primary">Budget vs Actual (Monthly)</h2>
            <Badge variant="warning">Watch {'>'}100% utilization</Badge>
          </div>
          <DataTable<BudgetRow>
            columns={[
              { key: 'budget_month', header: 'Month' },
              { key: 'budget_allocated_usd', header: 'Budget', align: 'right', render: (row) => usd(row.budget_allocated_usd) },
              { key: 'actual_spend_usd', header: 'Actual', align: 'right', render: (row) => usd(row.actual_spend_usd) },
              { key: 'budget_variance_usd', header: 'Variance', align: 'right', render: (row) => usd(row.budget_variance_usd) },
              { key: 'budget_utilization_ratio', header: 'Utilization', align: 'right', render: (row) => pct(row.budget_utilization_ratio) },
            ]}
            rows={budgetRows}
            emptyLabel="No budget rows"
          />
        </Card>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Card variant="elevated" className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-content-primary">Spend by Source</h2>
            <DataTable<SourceRow>
              columns={[
                { key: 'spend_month', header: 'Month' },
                { key: 'spend_source', header: 'Source' },
                { key: 'total_spend_usd', header: 'Spend', align: 'right', render: (row) => usd(row.total_spend_usd) },
              ]}
              rows={sourceRows}
              emptyLabel="No source rows"
            />
          </Card>

          <Card variant="elevated" className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-content-primary">Spend by Vendor</h2>
            <DataTable<VendorRow>
              columns={[
                { key: 'vendor_name', header: 'Vendor' },
                { key: 'total_spend_usd', header: 'Spend', align: 'right', render: (row) => usd(row.total_spend_usd) },
                { key: 'organization_count', header: 'Orgs', align: 'right' },
              ]}
              rows={vendorRows}
              emptyLabel="No vendor rows"
            />
          </Card>
        </section>

        <Card variant="elevated" className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-content-primary">Organization Financial Drilldown</h2>
          <DataTable<OrganizationFinanceRow>
            columns={[
              { key: 'organization_name', header: 'Organization' },
              { key: 'realized_revenue_usd', header: 'Realized', align: 'right', render: (row) => usd(row.realized_revenue_usd) },
              { key: 'pending_revenue_usd', header: 'Pending', align: 'right', render: (row) => usd(row.pending_revenue_usd) },
              { key: 'collection_rate_pct', header: 'Collect %', align: 'right', render: (row) => pct(row.collection_rate_pct) },
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
            emptyLabel="No organization finance rows"
          />
        </Card>
      </div>
    </TerminalShell>
  );
}
