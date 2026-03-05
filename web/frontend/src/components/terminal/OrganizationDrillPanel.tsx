'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, DataTable } from '@/components/ui';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface OrganizationProfile {
  organization_name: string;
  organization_status: string;
  subscription_status: string;
  current_plan_name: string;
  is_paying_customer: boolean;
  lifetime_sessions: number;
  days_since_last_session: number | null;
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
  priority: string;
  task_status: string;
  reason_code: string;
  signal_score: number;
}

interface AccountRow {
  account_id: string;
  account_name: string;
  lifecycle_stage: string;
  account_status: string;
  lifetime_realized_revenue_usd: number;
  lifetime_sessions: number;
  won_revenue_usd: number;
  account_owner_name: string;
}

interface ProjectRow {
  project_id: string;
  last_started_at: string;
  sessions_30d: number;
  success_rate_pct_30d: number;
  avg_duration_seconds_30d: number;
}

interface OrganizationDrillPanelProps {
  organizationId: string;
  onClose: () => void;
}

export default function OrganizationDrillPanel({ organizationId, onClose }: OrganizationDrillPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgProfile, setOrgProfile] = useState<OrganizationProfile | null>(null);
  const [revenueRows, setRevenueRows] = useState<RevenueRow[]>([]);
  const [riskRows, setRiskRows] = useState<RiskRow[]>([]);
  const [queueRows, setQueueRows] = useState<QueueRow[]>([]);
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const safeOrg = decodeURIComponent(organizationId || '').replace(/'/g, "''");

      try {
        const [profile, revenue, risk, queue, accounts, projects] = await Promise.all([
          runWarehouseQuerySafe(`
            SELECT
              organization_name,
              organization_status,
              subscription_status,
              current_plan_name,
              is_paying_customer,
              lifetime_sessions,
              days_since_last_session
            FROM core.dim_organizations
            WHERE organization_id = '${safeOrg}'
            LIMIT 1
          `),
          runWarehouseQuerySafe(`
            SELECT revenue_month, organization_name, current_plan_name, realized_revenue_usd, pending_revenue_usd, collection_rate_pct
            FROM fin.agg_revenue_monthly
            WHERE organization_id = '${safeOrg}'
            ORDER BY revenue_month DESC
            LIMIT 24
          `),
          runWarehouseQuerySafe(`
            SELECT triggered_at, signal_score, reason_code, days_remaining_in_trial, success_rate_7d, total_runs_7d
            FROM gtm.signal_trial_conversion_risk_daily
            WHERE organization_id = '${safeOrg}'
            ORDER BY triggered_at DESC
            LIMIT 60
          `),
          runWarehouseQuerySafe(`
            SELECT created_at, due_at, priority, task_status, reason_code, signal_score
            FROM gtm.growth_task_queue
            WHERE organization_id = '${safeOrg}'
            ORDER BY created_at DESC
            LIMIT 40
          `),
          runWarehouseQuerySafe(`
            SELECT
              account_id,
              account_name,
              lifecycle_stage,
              account_status,
              lifetime_realized_revenue_usd,
              lifetime_sessions,
              won_revenue_usd,
              account_owner_name
            FROM gtm.dim_lifecycle_accounts
            WHERE organization_id = '${safeOrg}'
            ORDER BY lifetime_realized_revenue_usd DESC, won_revenue_usd DESC, lifetime_sessions DESC
            LIMIT 30
          `),
          runWarehouseQuerySafe(`
            SELECT
              coalesce(project_id, 'unassigned') AS project_id,
              MAX(started_at) AS last_started_at,
              COUNT(*) AS sessions_30d,
              ROUND(100.0 * COUNT(CASE WHEN is_successful THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS success_rate_pct_30d,
              ROUND(AVG(duration_seconds), 2) AS avg_duration_seconds_30d
            FROM core.fct_browser_sessions
            WHERE organization_id = '${safeOrg}'
              AND session_date >= current_date - interval '30 days'
            GROUP BY 1
            ORDER BY sessions_30d DESC
            LIMIT 20
          `),
        ]);

        const topProfile = profile[0];
        setOrgProfile(
          topProfile
            ? {
                organization_name: String(topProfile.organization_name ?? ''),
                organization_status: String(topProfile.organization_status ?? ''),
                subscription_status: String(topProfile.subscription_status ?? ''),
                current_plan_name: String(topProfile.current_plan_name ?? ''),
                is_paying_customer: Boolean(topProfile.is_paying_customer),
                lifetime_sessions: num(topProfile.lifetime_sessions),
                days_since_last_session:
                  topProfile.days_since_last_session == null ? null : num(topProfile.days_since_last_session),
              }
            : null,
        );

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
            priority: String(row.priority ?? ''),
            task_status: String(row.task_status ?? ''),
            reason_code: String(row.reason_code ?? ''),
            signal_score: num(row.signal_score),
          })),
        );

        setAccountRows(
          accounts.map((row) => ({
            account_id: String(row.account_id ?? ''),
            account_name: String(row.account_name ?? ''),
            lifecycle_stage: String(row.lifecycle_stage ?? ''),
            account_status: String(row.account_status ?? ''),
            lifetime_realized_revenue_usd: num(row.lifetime_realized_revenue_usd),
            lifetime_sessions: num(row.lifetime_sessions),
            won_revenue_usd: num(row.won_revenue_usd),
            account_owner_name: String(row.account_owner_name ?? ''),
          })),
        );

        setProjectRows(
          projects.map((row) => ({
            project_id: String(row.project_id ?? ''),
            last_started_at: String(row.last_started_at ?? ''),
            sessions_30d: num(row.sessions_30d),
            success_rate_pct_30d: num(row.success_rate_pct_30d),
            avg_duration_seconds_30d: num(row.avg_duration_seconds_30d),
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load organization drill');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [organizationId]);

  const latestRevenue = revenueRows[0];
  const latestRisk = riskRows[0];
  const orgName = useMemo(
    () => orgProfile?.organization_name || latestRevenue?.organization_name || organizationId,
    [orgProfile, latestRevenue, organizationId],
  );

  return (
    <Card variant="elevated" className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-content-tertiary">Firm Drill</p>
          <h3 className="text-base font-semibold text-content-primary">{orgName}</h3>
          <p className="text-xs text-content-tertiary">Organization ID: {organizationId}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-content-secondary">
            <span>Status: {orgProfile?.organization_status || 'n/a'}</span>
            <span>Plan: {orgProfile?.current_plan_name || latestRevenue?.current_plan_name || 'n/a'}</span>
            <span>Sub: {orgProfile?.subscription_status || 'n/a'}</span>
            <Badge variant={orgProfile?.is_paying_customer ? 'accent' : 'neutral'}>
              {orgProfile?.is_paying_customer ? 'Paying Org' : 'Non-Paying Org'}
            </Badge>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={onClose}>Close Drill</Button>
      </div>

      {loading ? <p className="text-xs text-content-tertiary">Loading organization details...</p> : null}
      {error ? <p className="text-xs text-error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <section className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <div className="rounded border border-border bg-surface-primary p-2">
              <p className="text-[11px] text-content-tertiary">Realized</p>
              <p className="text-sm font-semibold text-content-primary">{latestRevenue ? usd(latestRevenue.realized_revenue_usd) : 'n/a'}</p>
            </div>
            <div className="rounded border border-border bg-surface-primary p-2">
              <p className="text-[11px] text-content-tertiary">Pending</p>
              <p className="text-sm font-semibold text-content-primary">{latestRevenue ? usd(latestRevenue.pending_revenue_usd) : 'n/a'}</p>
            </div>
            <div className="rounded border border-border bg-surface-primary p-2">
              <p className="text-[11px] text-content-tertiary">Collection %</p>
              <p className="text-sm font-semibold text-content-primary">{latestRevenue ? pct(latestRevenue.collection_rate_pct) : 'n/a'}</p>
            </div>
            <div className="rounded border border-border bg-surface-primary p-2">
              <p className="text-[11px] text-content-tertiary">Risk</p>
              <p className="text-sm font-semibold text-content-primary">{latestRisk ? `${(latestRisk.signal_score * 100).toFixed(0)}` : 'n/a'}</p>
            </div>
            <div className="rounded border border-border bg-surface-primary p-2">
              <p className="text-[11px] text-content-tertiary">Lifetime Sessions</p>
              <p className="text-sm font-semibold text-content-primary">
                {orgProfile ? orgProfile.lifetime_sessions.toLocaleString() : 'n/a'}
              </p>
            </div>
            <div className="rounded border border-border bg-surface-primary p-2">
              <p className="text-[11px] text-content-tertiary">Last Active (days)</p>
              <p className="text-sm font-semibold text-content-primary">
                {orgProfile?.days_since_last_session == null ? 'n/a' : orgProfile.days_since_last_session}
              </p>
            </div>
          </section>

          <section className="mb-3 rounded border border-border bg-surface-primary p-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">Firm Accounts</p>
            <DataTable<AccountRow>
              columns={[
                { key: 'account_name', header: 'Account' },
                { key: 'lifecycle_stage', header: 'Lifecycle' },
                { key: 'account_status', header: 'Status' },
                { key: 'account_owner_name', header: 'Owner' },
                { key: 'won_revenue_usd', header: 'Won', align: 'right', render: (row) => usd(row.won_revenue_usd) },
                { key: 'lifetime_realized_revenue_usd', header: 'Realized', align: 'right', render: (row) => usd(row.lifetime_realized_revenue_usd) },
                { key: 'lifetime_sessions', header: 'Sessions', align: 'right', render: (row) => row.lifetime_sessions.toLocaleString() },
              ]}
              rows={accountRows}
              emptyLabel="No account rows mapped to this paying organization"
            />
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">Financials</p>
              <DataTable<RevenueRow>
                columns={[
                  { key: 'revenue_month', header: 'Month' },
                  { key: 'current_plan_name', header: 'Plan' },
                  { key: 'realized_revenue_usd', header: 'Realized', align: 'right', render: (row) => usd(row.realized_revenue_usd) },
                  { key: 'pending_revenue_usd', header: 'Pending', align: 'right', render: (row) => usd(row.pending_revenue_usd) },
                  { key: 'collection_rate_pct', header: 'Collect %', align: 'right', render: (row) => pct(row.collection_rate_pct) },
                ]}
                rows={revenueRows}
                emptyLabel="No financial rows for this organization"
              />
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">Sessions + Reliability</p>
                <DataTable<RiskRow>
                  columns={[
                    { key: 'triggered_at', header: 'Date' },
                    { key: 'total_runs_7d', header: 'Runs 7d', align: 'right' },
                    { key: 'success_rate_7d', header: 'Success %', align: 'right', render: (row) => pct(row.success_rate_7d * 100) },
                    { key: 'signal_score', header: 'Risk', align: 'right', render: (row) => `${(row.signal_score * 100).toFixed(0)}` },
                    { key: 'reason_code', header: 'Reason' },
                  ]}
                  rows={riskRows}
                  emptyLabel="No reliability rows for this organization"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">Projects (30d)</p>
                <DataTable<ProjectRow>
                  columns={[
                    { key: 'project_id', header: 'Project' },
                    { key: 'sessions_30d', header: 'Sessions', align: 'right', render: (row) => row.sessions_30d.toLocaleString() },
                    { key: 'success_rate_pct_30d', header: 'Success %', align: 'right', render: (row) => pct(row.success_rate_pct_30d) },
                    {
                      key: 'avg_duration_seconds_30d',
                      header: 'Avg Dur',
                      align: 'right',
                      render: (row) => `${row.avg_duration_seconds_30d.toFixed(1)}s`,
                    },
                    { key: 'last_started_at', header: 'Last Start' },
                  ]}
                  rows={projectRows}
                  emptyLabel="No project session rows in last 30 days"
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">Action Queue</p>
                <DataTable<QueueRow>
                  columns={[
                    { key: 'created_at', header: 'Created' },
                    { key: 'priority', header: 'Priority', render: (row) => <Badge variant={row.priority === 'urgent' ? 'error' : row.priority === 'high' ? 'warning' : 'neutral'}>{row.priority || 'n/a'}</Badge> },
                    { key: 'task_status', header: 'Status' },
                    { key: 'reason_code', header: 'Reason' },
                    { key: 'due_at', header: 'Due' },
                  ]}
                  rows={queueRows}
                  emptyLabel="No queued actions for this organization"
                />
              </div>
            </div>
          </section>
        </>
      ) : null}
    </Card>
  );
}
