'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { Badge, Card, DataTable, EmptyState, LoadingState, Tabs } from '@/components/ui';

type TabKey = 'overview' | 'reliability' | 'revenue' | 'review';

interface QueryPayload {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}

interface RevenueRow {
  revenue_month: string;
  organization_name: string;
  current_plan_name: string;
  realized_revenue_usd: number;
  pending_revenue_usd: number;
  collection_rate_pct: number;
}

interface RiskRow {
  signal_score: number;
  reason_code: string;
  days_remaining_in_trial: number;
  success_rate_7d: number;
  total_runs_7d: number;
  triggered_at: string;
}

interface QueueRow {
  priority: 'urgent' | 'high' | 'normal';
  reason_code: string;
  signal_score: number;
  task_status: string;
  created_at: string;
  due_at: string;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

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

function priorityVariant(priority: QueueRow['priority']): 'error' | 'warning' | 'neutral' {
  if (priority === 'urgent') return 'error';
  if (priority === 'high') return 'warning';
  return 'neutral';
}

export default function FirmPage({ params }: { params: { organizationId: string } }) {
  const [tab, setTab] = useState<TabKey>('overview');
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
        const [revenue, risks, queue] = await Promise.all([
          runQuery(`
            SELECT revenue_month, organization_name, current_plan_name, realized_revenue_usd, pending_revenue_usd, collection_rate_pct
            FROM fin.agg_revenue_monthly
            WHERE organization_id = '${organizationId}'
            ORDER BY revenue_month DESC
            LIMIT 36
          `),
          runQuery(`
            SELECT signal_score, reason_code, days_remaining_in_trial, success_rate_7d, total_runs_7d, triggered_at
            FROM gtm.signal_trial_conversion_risk_daily
            WHERE organization_id = '${organizationId}'
            ORDER BY triggered_at DESC
            LIMIT 36
          `),
          runQuery(`
            SELECT priority, reason_code, signal_score, task_status, created_at, due_at
            FROM gtm.growth_task_queue
            WHERE organization_id = '${organizationId}'
            ORDER BY created_at DESC
            LIMIT 36
          `),
        ]);

        setRevenueRows(
          revenue.map((row) => ({
            revenue_month: String(row.revenue_month ?? ''),
            organization_name: String(row.organization_name ?? ''),
            current_plan_name: String(row.current_plan_name ?? ''),
            realized_revenue_usd: toNumber(row.realized_revenue_usd),
            pending_revenue_usd: toNumber(row.pending_revenue_usd),
            collection_rate_pct: toNumber(row.collection_rate_pct),
          })),
        );

        setRiskRows(
          risks.map((row) => ({
            signal_score: toNumber(row.signal_score),
            reason_code: String(row.reason_code ?? ''),
            days_remaining_in_trial: toNumber(row.days_remaining_in_trial),
            success_rate_7d: toNumber(row.success_rate_7d),
            total_runs_7d: toNumber(row.total_runs_7d),
            triggered_at: String(row.triggered_at ?? ''),
          })),
        );

        setQueueRows(
          queue.map((row) => ({
            priority: String(row.priority ?? 'normal') as QueueRow['priority'],
            reason_code: String(row.reason_code ?? ''),
            signal_score: toNumber(row.signal_score),
            task_status: String(row.task_status ?? ''),
            created_at: String(row.created_at ?? ''),
            due_at: String(row.due_at ?? ''),
          })),
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load firm view');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [organizationId]);

  const latestRevenue = revenueRows[0];
  const latestRisk = riskRows[0];
  const latestQueue = queueRows[0];

  const firmName = latestRevenue?.organization_name || organizationId;

  const review = useMemo(() => {
    const bull: string[] = [];
    const bear: string[] = [];
    const plays: string[] = [];

    if (latestRevenue) {
      if (latestRevenue.collection_rate_pct >= 85) {
        bull.push(`Strong collections (${formatPct(latestRevenue.collection_rate_pct)}) support realized revenue quality.`);
      } else {
        bear.push(`Collections are weaker (${formatPct(latestRevenue.collection_rate_pct)}), increasing cash timing risk.`);
      }

      if (latestRevenue.pending_revenue_usd > latestRevenue.realized_revenue_usd * 0.4) {
        bear.push(`Pending revenue (${formatUsd(latestRevenue.pending_revenue_usd)}) is elevated relative to realized revenue.`);
      }
    }

    if (latestRisk) {
      if (latestRisk.signal_score >= 0.75) {
        bear.push(`Conversion risk is high (${(latestRisk.signal_score * 100).toFixed(0)}), driven by ${latestRisk.reason_code}.`);
      } else {
        bull.push(`Conversion risk is moderate/low (${(latestRisk.signal_score * 100).toFixed(0)}).`);
      }

      if (latestRisk.success_rate_7d >= 0.8) {
        bull.push(`Reliability signal is strong with ${formatPct(latestRisk.success_rate_7d * 100)} run success in last 7 days.`);
      } else {
        bear.push(`Run success is soft (${formatPct(latestRisk.success_rate_7d * 100)}), likely impacting conversion confidence.`);
      }
    }

    if (latestQueue) {
      plays.push(`Execute ${latestQueue.priority} intervention tied to ${latestQueue.reason_code}.`);
    }
    plays.push('Run product reliability check and customer success outreach in parallel.');
    plays.push('Review plan fit and pricing guardrails before renewal/upgrade conversation.');

    return { bull, bear, plays };
  }, [latestRevenue, latestRisk, latestQueue]);

  if (loading) {
    return <LoadingState title="Loading firm view" description="Building reliability and revenue screens for this account." />;
  }

  if (error) {
    return <EmptyState title="Firm view unavailable" description={error} actionLabel="Back to GTMT" onAction={() => window.location.assign('/gtm-terminal')} />;
  }

  return (
    <div className="min-h-screen bg-surface-secondary p-4 text-content-primary">
      <div className="mx-auto max-w-[1400px] space-y-4">
        <header className="rounded-xl border border-border bg-surface-elevated p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link href="/gtm-terminal" className="text-xs text-content-tertiary hover:text-content-secondary">← Back to GTMT</Link>
              <h1 className="mt-1 text-2xl font-semibold">{firmName}</h1>
              <p className="text-sm text-content-secondary">Firm view for reliability and revenue with custom analyst review.</p>
            </div>
            <div className="flex items-center gap-2">
              {latestRisk ? <Badge variant={latestRisk.signal_score >= 0.75 ? 'error' : 'warning'}>Risk {(latestRisk.signal_score * 100).toFixed(0)}</Badge> : null}
              {latestQueue ? <Badge variant={priorityVariant(latestQueue.priority)}>{latestQueue.priority} play</Badge> : null}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card className="p-3">
            <p className="text-xs text-content-tertiary">Latest Revenue</p>
            <p className="mt-1 text-lg font-semibold">{formatUsd(latestRevenue?.realized_revenue_usd || 0)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-content-tertiary">Pending Revenue</p>
            <p className="mt-1 text-lg font-semibold">{formatUsd(latestRevenue?.pending_revenue_usd || 0)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-content-tertiary">Collection Rate</p>
            <p className="mt-1 text-lg font-semibold">{formatPct(latestRevenue?.collection_rate_pct || 0)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-content-tertiary">Run Success 7d</p>
            <p className="mt-1 text-lg font-semibold">{formatPct((latestRisk?.success_rate_7d || 0) * 100)}</p>
          </Card>
        </section>

        <Tabs
          items={[
            { key: 'overview', label: 'Overview' },
            { key: 'reliability', label: 'Reliability' },
            { key: 'revenue', label: 'Revenue' },
            { key: 'review', label: 'Custom Review' },
          ]}
          activeKey={tab}
          onChange={(next) => setTab(next as TabKey)}
        />

        {tab === 'overview' ? (
          <Card className="p-4">
            <p className="text-sm text-content-secondary">Cross-functional summary of this firm across revenue, risk, and queued actions.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <DataTable<QueueRow>
                columns={[
                  { key: 'priority', header: 'Priority', render: (row) => <Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge> },
                  { key: 'reason_code', header: 'Reason' },
                  { key: 'signal_score', header: 'Risk', align: 'right', render: (row) => `${(row.signal_score * 100).toFixed(0)}` },
                  { key: 'task_status', header: 'Status' },
                ]}
                rows={queueRows}
              />
              <DataTable<RiskRow>
                columns={[
                  { key: 'triggered_at', header: 'Triggered' },
                  { key: 'reason_code', header: 'Reason' },
                  { key: 'days_remaining_in_trial', header: 'Days Left', align: 'right' },
                  { key: 'success_rate_7d', header: 'Success %', align: 'right', render: (row) => formatPct(row.success_rate_7d * 100) },
                  { key: 'signal_score', header: 'Risk', align: 'right', render: (row) => `${(row.signal_score * 100).toFixed(0)}` },
                ]}
                rows={riskRows}
              />
            </div>
          </Card>
        ) : null}

        {tab === 'reliability' ? (
          <Card className="p-4">
            <DataTable<RiskRow>
              columns={[
                { key: 'triggered_at', header: 'Triggered At' },
                { key: 'reason_code', header: 'Reason' },
                { key: 'total_runs_7d', header: 'Runs 7d', align: 'right' },
                { key: 'success_rate_7d', header: 'Success %', align: 'right', render: (row) => formatPct(row.success_rate_7d * 100) },
                { key: 'signal_score', header: 'Risk', align: 'right', render: (row) => `${(row.signal_score * 100).toFixed(0)}` },
              ]}
              rows={riskRows}
            />
          </Card>
        ) : null}

        {tab === 'revenue' ? (
          <Card className="p-4">
            <DataTable<RevenueRow>
              columns={[
                { key: 'revenue_month', header: 'Month' },
                { key: 'current_plan_name', header: 'Plan' },
                { key: 'realized_revenue_usd', header: 'Realized', align: 'right', render: (row) => formatUsd(row.realized_revenue_usd) },
                { key: 'pending_revenue_usd', header: 'Pending', align: 'right', render: (row) => formatUsd(row.pending_revenue_usd) },
                { key: 'collection_rate_pct', header: 'Collection %', align: 'right', render: (row) => formatPct(row.collection_rate_pct) },
              ]}
              rows={revenueRows}
            />
          </Card>
        ) : null}

        {tab === 'review' ? (
          <Card className="p-4 space-y-4">
            <section>
              <h2 className="text-sm font-semibold">Bull Case</h2>
              <ul className="mt-2 space-y-1 text-sm text-content-secondary">
                {review.bull.length === 0 ? <li>No positive signals yet.</li> : review.bull.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </section>
            <section>
              <h2 className="text-sm font-semibold">Bear Case</h2>
              <ul className="mt-2 space-y-1 text-sm text-content-secondary">
                {review.bear.length === 0 ? <li>No major downside signals right now.</li> : review.bear.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </section>
            <section>
              <h2 className="text-sm font-semibold">Recommended Plays</h2>
              <ul className="mt-2 space-y-1 text-sm text-content-secondary">
                {review.plays.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </section>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
