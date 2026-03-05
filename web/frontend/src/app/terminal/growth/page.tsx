'use client';

import { useMemo, useState, useEffect } from 'react';
import { Badge, Button, Card, DataTable, EmptyState, LoadingState, StatTile } from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import OrganizationDrillPanel from '@/components/terminal/OrganizationDrillPanel';
import TerminalSection, { TerminalDataStatus } from '@/components/terminal/TerminalSection';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface TaskRow {
  task_id: string;
  organization_id: string;
  organization_name: string;
  signal_score: number;
  priority: string;
  reason_code: string;
  due_at: string;
}

interface FunnelRow {
  metric_date: string;
  leads_created: number;
  qualified_leads_created: number;
  leads_converted: number;
  opportunities_created: number;
  opportunities_closed_won: number;
}

interface ActionRow {
  action_type: string;
  status: string;
  action_count_7d: number;
}

interface PipelineSnapshot {
  as_of_date: string;
  open_pipeline_usd: number;
  won_revenue_usd: number;
  lead_conversion_rate_pct: number;
  opportunity_win_rate_pct: number;
}

interface UnitEconomicsRow {
  metric_month: string;
  realized_revenue_usd: number;
  campaign_spend_usd: number;
  pipeline_roas: number | null;
  cac_usd: number | null;
  ltv_proxy_usd: number | null;
}

interface ChannelEfficiencyRow {
  metric_month: string;
  channel: string;
  campaigns: number;
  won_revenue_usd: number;
  avg_roas: number | null;
}

type PriorityFilter = 'all' | 'urgent' | 'high' | 'normal';

function toPercentFromRatio(value: number): string {
  return `${Math.max(0, value * 100).toFixed(0)}%`;
}

function toRatePct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function normalizePriority(priority: string): 'urgent' | 'high' | 'normal' {
  const normalized = String(priority || '').toLowerCase();
  if (normalized === 'urgent') return 'urgent';
  if (normalized === 'high') return 'high';
  return 'normal';
}

function priorityBadgeVariant(priority: 'urgent' | 'high' | 'normal'): 'error' | 'warning' | 'neutral' {
  if (priority === 'urgent') return 'error';
  if (priority === 'high') return 'warning';
  return 'neutral';
}

function statusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  const normalized = status.toLowerCase();
  if (normalized.includes('success') || normalized.includes('complete') || normalized.includes('done')) return 'success';
  if (normalized.includes('retry') || normalized.includes('queued') || normalized.includes('pending')) return 'warning';
  if (normalized.includes('fail') || normalized.includes('error')) return 'error';
  return 'neutral';
}

function formatDueLabel(value: string): string {
  if (!value) return '-';
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return '-';
  const now = new Date();
  const deltaMs = due.getTime() - now.getTime();
  const deltaHours = Math.round(deltaMs / (1000 * 60 * 60));
  if (deltaHours < 0) return `Overdue ${Math.abs(deltaHours)}h`;
  if (deltaHours < 24) return `${deltaHours}h`;
  return `${Math.round(deltaHours / 24)}d`;
}

function prettyReasonCode(reasonCode: string): string {
  if (!reasonCode) return 'unlabeled';
  return reasonCode
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function toMonthLabel(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function metricValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : 'No data';
}

export default function GrowthTerminalPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [economics, setEconomics] = useState<UnitEconomicsRow[]>([]);
  const [channelEfficiency, setChannelEfficiency] = useState<ChannelEfficiencyRow[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [taskRows, funnelRows, actionRows, pipelineRows, economicsRows, fallbackEconomicsRows, channelRows] = await Promise.all([
          runWarehouseQuerySafe(`
            SELECT task_id, organization_id, organization_name, signal_score, priority, reason_code, due_at
            FROM gtm.growth_task_queue
            ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, signal_score DESC, due_at ASC
            LIMIT 120
          `),
          runWarehouseQuerySafe(`
            SELECT metric_date, leads_created, qualified_leads_created, leads_converted, opportunities_created, opportunities_closed_won
            FROM gtm.agg_funnel_daily
            WHERE metric_date >= CURRENT_DATE - INTERVAL '14 days'
            ORDER BY metric_date DESC
            LIMIT 30
          `),
          runWarehouseQuerySafe(`
            SELECT action_type, status, COUNT(*) AS action_count_7d
            FROM gtm.action_log
            WHERE executed_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
            GROUP BY 1, 2
            ORDER BY action_count_7d DESC
            LIMIT 25
          `),
          runWarehouseQuerySafe(`
            SELECT as_of_date, open_pipeline_usd, won_revenue_usd, lead_conversion_rate_pct, opportunity_win_rate_pct
            FROM gtm.snap_pipeline_daily
            ORDER BY as_of_date DESC
            LIMIT 1
          `),
          runWarehouseQuerySafe(`
            SELECT metric_month, realized_revenue_usd, campaign_spend_usd, pipeline_roas, cac_usd, ltv_proxy_usd
            FROM gtm.agg_unit_economics_monthly
            ORDER BY metric_month DESC
            LIMIT 12
          `),
          runWarehouseQuerySafe(`
            SELECT
              metric_month,
              SUM(won_revenue_usd) AS realized_revenue_usd,
              SUM(CASE WHEN campaign_roas > 0 THEN won_revenue_usd / campaign_roas ELSE 0 END) AS campaign_spend_usd,
              AVG(campaign_roas) AS pipeline_roas,
              NULL::DOUBLE AS cac_usd,
              NULL::DOUBLE AS ltv_proxy_usd
            FROM gtm.agg_campaign_channel_monthly
            GROUP BY 1
            ORDER BY metric_month DESC
            LIMIT 12
          `),
          runWarehouseQuerySafe(`
            SELECT
              metric_month,
              channel,
              COUNT(DISTINCT campaign_name) AS campaigns,
              SUM(won_revenue_usd) AS won_revenue_usd,
              AVG(campaign_roas) AS avg_roas
            FROM gtm.agg_campaign_channel_monthly
            GROUP BY 1, 2
            ORDER BY metric_month DESC, won_revenue_usd DESC
            LIMIT 240
          `),
        ]);

        setTasks(
          taskRows.map((row) => ({
            task_id: String(row.task_id ?? ''),
            organization_id: String(row.organization_id ?? ''),
            organization_name: String(row.organization_name ?? ''),
            signal_score: num(row.signal_score),
            priority: String(row.priority ?? ''),
            reason_code: String(row.reason_code ?? ''),
            due_at: String(row.due_at ?? ''),
          })),
        );

        setFunnel(
          funnelRows.map((row) => ({
            metric_date: String(row.metric_date ?? ''),
            leads_created: num(row.leads_created),
            qualified_leads_created: num(row.qualified_leads_created),
            leads_converted: num(row.leads_converted),
            opportunities_created: num(row.opportunities_created),
            opportunities_closed_won: num(row.opportunities_closed_won),
          })),
        );

        setActions(
          actionRows.map((row) => ({
            action_type: String(row.action_type ?? ''),
            status: String(row.status ?? ''),
            action_count_7d: num(row.action_count_7d),
          })),
        );

        const latestPipeline = pipelineRows[0];
        setPipeline(
          latestPipeline
            ? {
                as_of_date: String(latestPipeline.as_of_date ?? ''),
                open_pipeline_usd: num(latestPipeline.open_pipeline_usd),
                won_revenue_usd: num(latestPipeline.won_revenue_usd),
                lead_conversion_rate_pct: num(latestPipeline.lead_conversion_rate_pct),
                opportunity_win_rate_pct: num(latestPipeline.opportunity_win_rate_pct),
              }
            : null,
        );

        const primaryEconomics = economicsRows.map((row) => ({
          metric_month: String(row.metric_month ?? ''),
          realized_revenue_usd: num(row.realized_revenue_usd),
          campaign_spend_usd: num(row.campaign_spend_usd),
          pipeline_roas: row.pipeline_roas == null ? null : num(row.pipeline_roas),
          cac_usd: row.cac_usd == null ? null : num(row.cac_usd),
          ltv_proxy_usd: row.ltv_proxy_usd == null ? null : num(row.ltv_proxy_usd),
        }));

        const backupEconomics = fallbackEconomicsRows.map((row) => ({
          metric_month: String(row.metric_month ?? ''),
          realized_revenue_usd: num(row.realized_revenue_usd),
          campaign_spend_usd: num(row.campaign_spend_usd),
          pipeline_roas: row.pipeline_roas == null ? null : num(row.pipeline_roas),
          cac_usd: row.cac_usd == null ? null : num(row.cac_usd),
          ltv_proxy_usd: row.ltv_proxy_usd == null ? null : num(row.ltv_proxy_usd),
        }));

        const synthesizedEconomics =
          primaryEconomics.length > 0
            ? primaryEconomics
            : backupEconomics.length > 0
              ? backupEconomics
              : latestPipeline
                ? [
                    {
                      metric_month: String(latestPipeline.as_of_date ?? ''),
                      realized_revenue_usd: num(latestPipeline.won_revenue_usd),
                      campaign_spend_usd: 0,
                      pipeline_roas: null,
                      cac_usd: null,
                      ltv_proxy_usd: null,
                    },
                  ]
                : [];

        setEconomics(synthesizedEconomics);

        const allChannelRows = channelRows.map((row) => ({
            metric_month: String(row.metric_month ?? ''),
            channel: String(row.channel ?? ''),
            campaigns: num(row.campaigns),
            won_revenue_usd: num(row.won_revenue_usd),
            avg_roas: row.avg_roas == null ? null : num(row.avg_roas),
          }));
        const latestChannelMonth = allChannelRows[0]?.metric_month || '';
        setChannelEfficiency(allChannelRows.filter((row) => row.metric_month === latestChannelMonth));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load growth terminal');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const urgent = useMemo(() => tasks.filter((row) => normalizePriority(row.priority) === 'urgent').length, [tasks]);
  const high = useMemo(() => tasks.filter((row) => normalizePriority(row.priority) === 'high').length, [tasks]);
  const normal = Math.max(0, tasks.length - urgent - high);

  const latestFunnel = funnel[0];
  const previousFunnel = funnel[1];
  const latestEconomics = economics[0];

  const dueSoon = useMemo(() => {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return tasks.filter((row) => {
      if (!row.due_at) return false;
      const due = new Date(row.due_at);
      if (Number.isNaN(due.getTime())) return false;
      return due <= in48h;
    }).length;
  }, [tasks]);

  const avgRiskRatio = useMemo(() => {
    if (tasks.length === 0) return 0;
    return tasks.reduce((acc, row) => acc + row.signal_score, 0) / tasks.length;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (priorityFilter === 'all') return tasks;
    return tasks.filter((row) => normalizePriority(row.priority) === priorityFilter);
  }, [priorityFilter, tasks]);

  const topReasons = useMemo(() => {
    const counts = new Map<string, { count: number; totalRisk: number }>();
    filteredTasks.forEach((row) => {
      const key = prettyReasonCode(row.reason_code).toLowerCase();
      const current = counts.get(key) || { count: 0, totalRisk: 0 };
      counts.set(key, { count: current.count + 1, totalRisk: current.totalRisk + row.signal_score });
    });
    return Array.from(counts.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        avgRisk: data.count > 0 ? data.totalRisk / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredTasks]);

  const actionTotal = useMemo(() => actions.reduce((acc, row) => acc + row.action_count_7d, 0), [actions]);
  const successfulActionTotal = useMemo(
    () =>
      actions
        .filter((row) => {
          const status = row.status.toLowerCase();
          return status.includes('success') || status.includes('complete') || status.includes('done');
        })
        .reduce((acc, row) => acc + row.action_count_7d, 0),
    [actions],
  );

  const leadToQualifiedPct = latestFunnel ? toRatePct(latestFunnel.qualified_leads_created, latestFunnel.leads_created) : 0;
  const qualifiedToConvertedPct = latestFunnel ? toRatePct(latestFunnel.leads_converted, latestFunnel.qualified_leads_created) : 0;

  const leadsDelta = latestFunnel && previousFunnel ? latestFunnel.leads_created - previousFunnel.leads_created : 0;
  const spendPerLead = latestEconomics && latestFunnel && latestFunnel.leads_created > 0 ? latestEconomics.campaign_spend_usd / latestFunnel.leads_created : null;
  const hasEconomicModelData = economics.some((row) => row.cac_usd != null || row.ltv_proxy_usd != null || row.pipeline_roas != null);
  const latestFunnelDate = latestFunnel?.metric_date ? new Date(latestFunnel.metric_date).toLocaleDateString() : 'n/a';
  const coverageLabel = `${tasks.length} queue tasks · ${channelEfficiency.length} channels · ${economics.length} monthly rows`;

  if (loading) {
    return (
      <TerminalShell active="growth" title="Growth Terminal" subtitle="Department-wide growth operations from demand generation through CAC.">
        <LoadingState title="Loading growth terminal" description="Compiling full-funnel and acquisition economics signals." />
      </TerminalShell>
    );
  }

  if (error) {
    return (
      <TerminalShell active="growth" title="Growth Terminal" subtitle="Department-wide growth operations from demand generation through CAC.">
        <EmptyState title="Growth terminal unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell active="growth" title="Growth Terminal" subtitle="Department-wide growth operations from demand generation through CAC.">
      <div className="space-y-3">
        {selectedOrganizationId ? (
          <OrganizationDrillPanel organizationId={selectedOrganizationId} onClose={() => setSelectedOrganizationId(null)} />
        ) : null}

        <TerminalDataStatus
          freshnessLabel={`Latest funnel date ${latestFunnelDate}`}
          coverageLabel={coverageLabel}
          qualityLabel={hasEconomicModelData ? 'Modeled economics available' : 'Fallback economics active'}
        />

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
          <StatTile
            label="Leads (Latest)"
            value={(latestFunnel?.leads_created ?? 0).toLocaleString()}
            delta={latestFunnel ? `${leadsDelta >= 0 ? '+' : ''}${leadsDelta} vs prior day` : undefined}
            trend={leadsDelta >= 0 ? 'up' : 'down'}
          />
          <StatTile label="Lead -> Qualified" value={`${leadToQualifiedPct.toFixed(1)}%`} trend={leadToQualifiedPct >= 25 ? 'up' : 'neutral'} />
          <StatTile label="Qualified -> Converted" value={`${qualifiedToConvertedPct.toFixed(1)}%`} trend={qualifiedToConvertedPct >= 20 ? 'up' : 'neutral'} />
          <StatTile label="Lead Conversion" value={metricValue(pipeline ? pct(pipeline.lead_conversion_rate_pct) : null)} trend="neutral" />
          <StatTile label="Open Pipeline" value={metricValue(pipeline ? usd(pipeline.open_pipeline_usd) : null)} trend="up" />
          <StatTile label="Won Revenue" value={metricValue(pipeline ? usd(pipeline.won_revenue_usd) : null)} trend="up" />
          <StatTile label="Campaign Spend" value={metricValue(latestEconomics ? usd(latestEconomics.campaign_spend_usd) : null)} trend="neutral" />
          <StatTile label="CAC" value={metricValue(latestEconomics?.cac_usd == null ? null : usd(latestEconomics.cac_usd))} trend="neutral" />
        </section>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <TerminalSection title="Full Funnel Performance (14d)" subtitle="Daily lead-to-opportunity conversion with close rate context." command="GRO FUNNEL" className="xl:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="accent">Lead to Qual {leadToQualifiedPct.toFixed(1)}%</Badge>
                <Badge variant="neutral">Qual to Conv {qualifiedToConvertedPct.toFixed(1)}%</Badge>
                <Badge variant="neutral">Opp Win {metricValue(pipeline ? pct(pipeline.opportunity_win_rate_pct) : null)}</Badge>
              </div>
            </div>
            <DataTable<FunnelRow>
              columns={[
                { key: 'metric_date', header: 'Date' },
                { key: 'leads_created', header: 'Leads', align: 'right' },
                { key: 'qualified_leads_created', header: 'Qualified', align: 'right' },
                { key: 'leads_converted', header: 'Converted', align: 'right' },
                { key: 'opportunities_created', header: 'Opp Created', align: 'right' },
                { key: 'opportunities_closed_won', header: 'Opp Won', align: 'right' },
              ]}
              rows={funnel}
              emptyLabel="No funnel rows"
            />
          </TerminalSection>

          <TerminalSection title="Acquisition Economics" subtitle="Current operating efficiency and monetization yield." command="GRO CAC">
            <div className="mb-3 flex items-center justify-between gap-2">
              {!hasEconomicModelData ? <Badge variant="warning">Using fallback data</Badge> : null}
            </div>
            <div className="space-y-2">
              <div className="rounded-lg border border-border bg-surface-primary p-3">
                <p className="text-xs uppercase tracking-wide text-content-tertiary">Pipeline ROAS</p>
                <p className="mt-1 text-xl font-semibold text-content-primary">{metricValue(latestEconomics?.pipeline_roas == null ? null : latestEconomics.pipeline_roas.toFixed(2))}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-primary p-3">
                <p className="text-xs uppercase tracking-wide text-content-tertiary">LTV : CAC</p>
                <p className="mt-1 text-xl font-semibold text-content-primary">
                  {latestEconomics?.ltv_proxy_usd && latestEconomics?.cac_usd && latestEconomics.cac_usd > 0
                    ? (latestEconomics.ltv_proxy_usd / latestEconomics.cac_usd).toFixed(2)
                    : 'No data'}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface-primary p-3">
                <p className="text-xs uppercase tracking-wide text-content-tertiary">Spend per Lead (Latest)</p>
                <p className="mt-1 text-xl font-semibold text-content-primary">{metricValue(spendPerLead == null ? null : usd(spendPerLead))}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-primary p-3">
                <p className="text-xs uppercase tracking-wide text-content-tertiary">Realized Revenue (Latest Month)</p>
                <p className="mt-1 text-xl font-semibold text-content-primary">{metricValue(latestEconomics ? usd(latestEconomics.realized_revenue_usd) : null)}</p>
              </div>
            </div>
          </TerminalSection>
        </section>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Card variant="elevated" className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-content-primary">Channel Efficiency (Current Month)</h2>
              <Badge variant="neutral">{metricValue(channelEfficiency[0] ? toMonthLabel(channelEfficiency[0].metric_month) : null)}</Badge>
            </div>
            <DataTable<ChannelEfficiencyRow>
              columns={[
                { key: 'channel', header: 'Channel' },
                { key: 'campaigns', header: 'Campaigns', align: 'right' },
                { key: 'won_revenue_usd', header: 'Won Revenue', align: 'right', render: (row) => usd(row.won_revenue_usd) },
                { key: 'avg_roas', header: 'Avg ROAS', align: 'right', render: (row) => metricValue(row.avg_roas == null ? null : row.avg_roas.toFixed(2)) },
              ]}
              rows={channelEfficiency}
              emptyLabel="No channel rows. Load gtm.agg_campaign_channel_monthly to populate this section."
            />
          </Card>

          <Card variant="elevated" className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-content-primary">Unit Economics Trend (12m)</h2>
              <Badge variant="neutral">Revenue, Spend, CAC</Badge>
            </div>
            <DataTable<UnitEconomicsRow>
              columns={[
                { key: 'metric_month', header: 'Month', render: (row) => toMonthLabel(row.metric_month) },
                { key: 'realized_revenue_usd', header: 'Revenue', align: 'right', render: (row) => usd(row.realized_revenue_usd) },
                { key: 'campaign_spend_usd', header: 'Spend', align: 'right', render: (row) => usd(row.campaign_spend_usd) },
                { key: 'cac_usd', header: 'CAC', align: 'right', render: (row) => metricValue(row.cac_usd == null ? null : usd(row.cac_usd)) },
                { key: 'pipeline_roas', header: 'ROAS', align: 'right', render: (row) => metricValue(row.pipeline_roas == null ? null : row.pipeline_roas.toFixed(2)) },
              ]}
              rows={economics}
              emptyLabel="No unit economics rows. Run gtm.agg_unit_economics_monthly model to populate this section."
            />
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <Card variant="elevated" className="p-4 xl:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-content-primary">Execution Queue</h2>
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'urgent', 'high', 'normal'] as PriorityFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPriorityFilter(filter)}
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      priorityFilter === filter ? 'bg-accent text-white' : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
                    }`}
                  >
                    {filter.toUpperCase()}
                  </button>
                ))}
                <Badge variant="warning">Due & risk sorted</Badge>
              </div>
            </div>

            <div className="mb-3 rounded-lg border border-border bg-surface-primary p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-content-secondary">
                <span>Queue mix</span>
                <span>
                  Urgent {urgent} / High {high} / Normal {normal} / Due &lt;48h {dueSoon}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-secondary">
                <div className="flex h-full w-full">
                  <div className="bg-error" style={{ width: `${tasks.length ? (urgent / tasks.length) * 100 : 0}%` }} />
                  <div className="bg-warning" style={{ width: `${tasks.length ? (high / tasks.length) * 100 : 0}%` }} />
                  <div className="bg-content-tertiary/40" style={{ width: `${tasks.length ? (normal / tasks.length) * 100 : 0}%` }} />
                </div>
              </div>
            </div>

            <DataTable<TaskRow>
              columns={[
                { key: 'organization_name', header: 'Organization' },
                {
                  key: 'priority',
                  header: 'Priority',
                  render: (row) => {
                    const priority = normalizePriority(row.priority);
                    return <Badge variant={priorityBadgeVariant(priority)}>{priority.toUpperCase()}</Badge>;
                  },
                },
                {
                  key: 'signal_score',
                  header: 'Risk',
                  align: 'right',
                  render: (row) => (
                    <div className="flex min-w-[88px] items-center justify-end gap-2">
                      <span>{toPercentFromRatio(row.signal_score)}</span>
                      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-secondary">
                        <div className="h-full bg-error" style={{ width: `${Math.max(0, Math.min(100, row.signal_score * 100))}%` }} />
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'reason_code',
                  header: 'Reason',
                  render: (row) => <span className="capitalize">{prettyReasonCode(row.reason_code)}</span>,
                },
                {
                  key: 'due_at',
                  header: 'Due',
                  render: (row) => (
                    <div>
                      <p>{row.due_at ? new Date(row.due_at).toLocaleDateString() : '-'}</p>
                      <p className="text-xs text-content-tertiary">{formatDueLabel(row.due_at)}</p>
                    </div>
                  ),
                },
                {
                  key: 'drill',
                  header: 'Drill',
                  render: (row) =>
                    row.organization_id ? (
                      <Button size="sm" variant="ghost" onClick={() => setSelectedOrganizationId(row.organization_id)}>
                        Open
                      </Button>
                    ) : (
                      'No data'
                    ),
                },
              ]}
              rows={filteredTasks.slice(0, 50)}
              emptyLabel="No task rows"
            />
          </Card>

          <Card variant="elevated" className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-content-primary">Execution Health</h2>
                <Badge variant={actionTotal > 0 && successfulActionTotal / actionTotal >= 0.7 ? 'success' : 'warning'}>
                Success {actionTotal > 0 ? `${Math.round((successfulActionTotal / actionTotal) * 100)}%` : 'No data'}
              </Badge>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-surface-primary p-3">
                <p className="text-xs uppercase tracking-wide text-content-tertiary">Pending Tasks</p>
                <p className="mt-1 text-xl font-semibold text-content-primary">{tasks.length.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-primary p-3">
                <p className="text-xs uppercase tracking-wide text-content-tertiary">Avg Risk</p>
                <p className="mt-1 text-xl font-semibold text-content-primary">{toPercentFromRatio(avgRiskRatio)}</p>
              </div>
            </div>

            <DataTable<ActionRow>
              columns={[
                { key: 'action_type', header: 'Action' },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => <Badge variant={statusBadgeVariant(row.status)}>{row.status || 'unknown'}</Badge>,
                },
                { key: 'action_count_7d', header: 'Count', align: 'right' },
              ]}
              rows={actions}
              emptyLabel="No action log rows"
            />

            <div className="mt-3 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Top Risk Reasons</h3>
              {topReasons.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface-primary px-3 py-3 text-sm text-content-tertiary">No clustered reasons</p>
              ) : (
                topReasons.map((reason) => (
                  <div key={reason.reason} className="rounded-lg border border-border bg-surface-primary px-3 py-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium capitalize text-content-primary">{reason.reason}</p>
                      <Badge variant="neutral">{reason.count}</Badge>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                      <div className="h-full bg-warning" style={{ width: `${Math.max(0, Math.min(100, reason.avgRisk * 100))}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>
      </div>
    </TerminalShell>
  );
}
