'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Badge,
  Card,
  DataTable,
  EmptyState,
  LoadingState,
} from '@/components/ui';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';
import TerminalShell from '@/components/terminal/TerminalShell';

interface CustomerRow {
  organization_id: string;
  organization_name: string;
  realized_revenue_usd: number;
  pending_revenue_usd: number;
  collection_rate_pct: number;
  runs_7d: number;
  success_rate_7d: number;
  risk_score: number;
}

export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [financeRows, riskRows] = await Promise.all([
          runWarehouseQuerySafe(`
            SELECT organization_id, organization_name, realized_revenue_usd, pending_revenue_usd, collection_rate_pct
            FROM fin.agg_revenue_monthly
            ORDER BY revenue_month DESC, realized_revenue_usd DESC
            LIMIT 250
          `),
          runWarehouseQuerySafe(`
            SELECT organization_id, signal_score, success_rate_7d, total_runs_7d
            FROM gtm.signal_trial_conversion_risk_daily
            ORDER BY triggered_at DESC
            LIMIT 500
          `),
        ]);

        const latestRiskByOrg = new Map<string, Record<string, unknown>>();
        for (const row of riskRows) {
          const orgId = String(row.organization_id ?? '');
          if (!orgId || latestRiskByOrg.has(orgId)) continue;
          latestRiskByOrg.set(orgId, row);
        }

        const joined = financeRows
          .map((row) => {
            const organization_id = String(row.organization_id ?? '');
            const risk = latestRiskByOrg.get(organization_id);
            return {
              organization_id,
              organization_name: String(row.organization_name ?? ''),
              realized_revenue_usd: num(row.realized_revenue_usd),
              pending_revenue_usd: num(row.pending_revenue_usd),
              collection_rate_pct: num(row.collection_rate_pct),
              runs_7d: num(risk?.total_runs_7d),
              success_rate_7d: num(risk?.success_rate_7d),
              risk_score: num(risk?.signal_score) * 100,
            };
          })
          .filter((row) => row.organization_id.length > 0)
          .slice(0, 100);

        setRows(joined);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <TerminalShell active="executive" title="Customer Terminal" subtitle="Account-level revenue, reliability, and risk drilldown surface.">
        <LoadingState title="Loading customers" description="Building customer-equity table from finance and risk datasets." />
      </TerminalShell>
    );
  }

  if (error) {
    return (
      <TerminalShell active="executive" title="Customer Terminal" subtitle="Account-level revenue, reliability, and risk drilldown surface.">
        <EmptyState title="Customers unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell active="executive" title="Customer Terminal" subtitle="Account-level revenue, reliability, and risk drilldown surface.">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-content-primary">Top customer equities by realized revenue with reliability context.</h2>
          <Badge variant="accent">Top {rows.length}</Badge>
        </div>

        <Card variant="elevated" className="p-4">
          <DataTable<CustomerRow>
            columns={[
              { key: 'organization_name', header: 'Customer' },
              { key: 'realized_revenue_usd', header: 'Realized', align: 'right', render: (row) => usd(row.realized_revenue_usd) },
              { key: 'pending_revenue_usd', header: 'Pending', align: 'right', render: (row) => usd(row.pending_revenue_usd) },
              { key: 'collection_rate_pct', header: 'Collections', align: 'right', render: (row) => pct(row.collection_rate_pct) },
              { key: 'runs_7d', header: 'Runs 7d', align: 'right' },
              { key: 'success_rate_7d', header: 'Success 7d', align: 'right', render: (row) => pct(row.success_rate_7d * 100) },
              { key: 'risk_score', header: 'Risk', align: 'right', render: (row) => (row.risk_score > 0 ? row.risk_score.toFixed(0) : 'n/a') },
              {
                key: 'drill',
                header: 'Drill',
                render: (row) => (
                  <Link href={`/customers/${encodeURIComponent(row.organization_id)}`} className="text-accent hover:underline">
                    Open
                  </Link>
                ),
              },
            ]}
            rows={rows}
            emptyLabel="No customer rows available."
          />
        </Card>
      </div>
    </TerminalShell>
  );
}
