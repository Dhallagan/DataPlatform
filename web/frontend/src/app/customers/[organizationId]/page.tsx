'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, DataTable, EmptyState, LoadingState, Tabs } from '@/components/ui';
import { num, pct, runWarehouseQuery, runWarehouseQuerySafe, usd } from '@/lib/warehouse';
import TerminalShell from '@/components/terminal/TerminalShell';

type TabKey = 'financials' | 'sessions' | 'reliability';

interface RevenueRow {
  revenue_month: string;
  organization_name: string;
  current_plan_name: string;
  realized_revenue_usd: number;
  pending_revenue_usd: number;
  collection_rate_pct: number;
}

interface RiskRow {
  triggered_at: string;
  signal_score: number;
  reason_code: string;
  days_remaining_in_trial: number;
  success_rate_7d: number;
  total_runs_7d: number;
}

interface QueueRow {
  created_at: string;
  due_at: string;
  priority: 'urgent' | 'high' | 'normal';
  task_status: string;
  reason_code: string;
  signal_score: number;
}

function priorityVariant(priority: QueueRow['priority']): 'error' | 'warning' | 'neutral' {
  if (priority === 'urgent') return 'error';
  if (priority === 'high') return 'warning';
  return 'neutral';
}

export default function CustomerDetailPage({ params }: { params: { organizationId: string } }) {
  const [tab, setTab] = useState<TabKey>('financials');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueRows, setRevenueRows] = useState<RevenueRow[]>([]);
  const [riskRows, setRiskRows] = useState<RiskRow[]>([]);
  const [queueRows, setQueueRows] = useState<QueueRow[]>([]);

  const organizationId = decodeURIComponent(params.organizationId || '').replace(/'/g, "''");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [revenue, risk, queue] = await Promise.all([
          runWarehouseQuery(`
            SELECT revenue_month, organization_name, current_plan_name, realized_revenue_usd, pending_revenue_usd, collection_rate_pct
            FROM fin.agg_revenue_monthly
            WHERE organization_id = '${organizationId}'
            ORDER BY revenue_month DESC
            LIMIT 48
          `),
          runWarehouseQuerySafe(`
            SELECT triggered_at, signal_score, reason_code, days_remaining_in_trial, success_rate_7d, total_runs_7d
            FROM gtm.signal_trial_conversion_risk_daily
            WHERE organization_id = '${organizationId}'
            ORDER BY triggered_at DESC
            LIMIT 90
          `),
          runWarehouseQuerySafe(`
            SELECT created_at, due_at, priority, task_status, reason_code, signal_score
            FROM gtm.growth_task_queue
            WHERE organization_id = '${organizationId}'
            ORDER BY created_at DESC
            LIMIT 50
          `),
        ]);

        setRevenueRows(
          revenue.map((row) => ({
            revenue_month: String(row.revenue_month ?? ''),
            organization_name: String(row.organization_name ?? ''),
            current_plan_name: String(row.current_plan_name ?? ''),
            realized_revenue_usd: num(row.realized_revenue_usd),
            pending_revenue_usd: num(row.pending_revenue_usd),
            collection_rate_pct: num(row.collection_rate_pct),
          })),
        );

        setRiskRows(
          risk.map((row) => ({
            triggered_at: String(row.triggered_at ?? ''),
            signal_score: num(row.signal_score),
            reason_code: String(row.reason_code ?? ''),
            days_remaining_in_trial: num(row.days_remaining_in_trial),
            success_rate_7d: num(row.success_rate_7d),
            total_runs_7d: num(row.total_runs_7d),
          })),
        );

        setQueueRows(
          queue.map((row) => ({
            created_at: String(row.created_at ?? ''),
            due_at: String(row.due_at ?? ''),
            priority: String(row.priority ?? 'normal') as QueueRow['priority'],
            task_status: String(row.task_status ?? ''),
            reason_code: String(row.reason_code ?? ''),
            signal_score: num(row.signal_score),
          })),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load customer page');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [organizationId]);

  const latestRevenue = revenueRows[0];
  const latestRisk = riskRows[0];
  const latestQueue = queueRows[0];

  const customerName = useMemo(() => {
    if (latestRevenue?.organization_name) return latestRevenue.organization_name;
    return organizationId;
  }, [latestRevenue, organizationId]);

  if (loading) {
    return (
      <TerminalShell active="executive" title="Customer Drill" subtitle="Financial, session, and reliability drill view.">
        <LoadingState title="Loading customer page" description="Pulling financials, sessions, and reliability history." />
      </TerminalShell>
    );
  }

  if (error) {
    return (
      <TerminalShell active="executive" title="Customer Drill" subtitle="Financial, session, and reliability drill view.">
        <EmptyState title="Customer page unavailable" description={error} actionLabel="Back to customers" onAction={() => window.location.assign('/customers')} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell active="executive" title={customerName} subtitle="Customer drill page across financials, sessions, and reliability.">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/customers" className="text-xs text-content-tertiary hover:text-content-primary">
            ← Back to Customers
          </Link>
          {latestRisk ? <Badge variant={latestRisk.signal_score >= 0.8 ? 'error' : 'warning'}>Risk {(latestRisk.signal_score * 100).toFixed(0)}</Badge> : null}
          {latestQueue ? <Badge variant={priorityVariant(latestQueue.priority)}>{latestQueue.priority} queue</Badge> : null}
        </div>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card className="p-3">
            <p className="text-xs text-content-tertiary">Realized Revenue</p>
            <p className="mt-1 text-lg font-semibold">{usd(latestRevenue?.realized_revenue_usd || 0)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-content-tertiary">Pending Revenue</p>
            <p className="mt-1 text-lg font-semibold">{usd(latestRevenue?.pending_revenue_usd || 0)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-content-tertiary">Collection Rate</p>
            <p className="mt-1 text-lg font-semibold">{pct(latestRevenue?.collection_rate_pct || 0)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-content-tertiary">Runs (7d)</p>
            <p className="mt-1 text-lg font-semibold">{latestRisk?.total_runs_7d || 0}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-content-tertiary">Success (7d)</p>
            <p className="mt-1 text-lg font-semibold">{pct((latestRisk?.success_rate_7d || 0) * 100)}</p>
          </Card>
        </section>

        <Tabs
          items={[
            { key: 'financials', label: 'Financials' },
            { key: 'sessions', label: 'Sessions' },
            { key: 'reliability', label: 'Reliability' },
          ]}
          activeKey={tab}
          onChange={(next) => setTab(next as TabKey)}
        />

        {tab === 'financials' ? (
          <Card variant="elevated" className="p-4">
            <DataTable<RevenueRow>
              columns={[
                { key: 'revenue_month', header: 'Month' },
                { key: 'current_plan_name', header: 'Plan' },
                { key: 'realized_revenue_usd', header: 'Realized', align: 'right', render: (row) => usd(row.realized_revenue_usd) },
                { key: 'pending_revenue_usd', header: 'Pending', align: 'right', render: (row) => usd(row.pending_revenue_usd) },
                { key: 'collection_rate_pct', header: 'Collection %', align: 'right', render: (row) => pct(row.collection_rate_pct) },
              ]}
              rows={revenueRows}
              emptyLabel="No finance rows for this customer."
            />
          </Card>
        ) : null}

        {tab === 'sessions' ? (
          <Card variant="elevated" className="p-4">
            <DataTable<RiskRow>
              columns={[
                { key: 'triggered_at', header: 'Date' },
                { key: 'total_runs_7d', header: 'Runs 7d', align: 'right' },
                { key: 'success_rate_7d', header: 'Success %', align: 'right', render: (row) => pct(row.success_rate_7d * 100) },
                { key: 'days_remaining_in_trial', header: 'Days Left', align: 'right' },
              ]}
              rows={riskRows}
              emptyLabel="No session/reliability rows for this customer."
            />
          </Card>
        ) : null}

        {tab === 'reliability' ? (
          <Card variant="elevated" className="p-4 space-y-3">
            <DataTable<RiskRow>
              columns={[
                { key: 'triggered_at', header: 'Triggered At' },
                { key: 'reason_code', header: 'Reason Code' },
                { key: 'signal_score', header: 'Risk', align: 'right', render: (row) => `${(row.signal_score * 100).toFixed(0)}` },
                { key: 'success_rate_7d', header: 'Success %', align: 'right', render: (row) => pct(row.success_rate_7d * 100) },
              ]}
              rows={riskRows}
              emptyLabel="No conversion-risk rows for this customer."
            />

            <DataTable<QueueRow>
              columns={[
                { key: 'created_at', header: 'Created' },
                { key: 'priority', header: 'Priority', render: (row) => <Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge> },
                { key: 'task_status', header: 'Status' },
                { key: 'reason_code', header: 'Reason' },
                { key: 'signal_score', header: 'Risk', align: 'right', render: (row) => `${(row.signal_score * 100).toFixed(0)}` },
                { key: 'due_at', header: 'Due' },
              ]}
              rows={queueRows}
              emptyLabel="No queued plays for this customer."
            />
          </Card>
        ) : null}
      </div>
    </TerminalShell>
  );
}
