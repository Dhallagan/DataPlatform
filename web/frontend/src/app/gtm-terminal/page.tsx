'use client';

import { KeyboardEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  LoadingState,
  SearchInput,
} from '@/components/ui';

type TerminalFn = 'MKT' | 'NEWS' | 'PIPE' | 'RISK' | 'RELI' | 'MIX' | 'CAMP' | 'FIN' | 'PLAY' | 'OPS';
type WidgetKey = 'main' | 'news' | 'blotter';

interface QueryPayload {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}

interface TrendPoint {
  label: string;
  value: number;
}

interface FunctionSpec {
  key: TerminalFn;
  name: string;
  desc: string;
  objective: string;
  action: string;
  source: string;
}

interface ProductMarketRow {
  market: string;
  ticker: string;
  value: number;
  change_pct: number | null;
}

interface EventRow {
  time: string;
  headline: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

interface RiskRow {
  organization_id: string;
  organization_name: string;
  signal_score: number;
  reason_code: string;
  days_remaining_in_trial: number;
  success_rate_7d: number;
  total_runs_7d: number;
}

interface QueueRow {
  organization_id: string;
  organization_name: string;
  priority: 'urgent' | 'high' | 'normal';
  reason_code: string;
  signal_score: number;
}

interface CampaignRow {
  metric_month: string;
  campaign_name: string;
  channel: string;
  won_revenue_usd: number;
  campaign_roas: number | null;
}

interface FinanceRow {
  organization_id: string;
  revenue_month: string;
  organization_name: string;
  current_plan_name: string;
  realized_revenue_usd: number;
  pending_revenue_usd: number;
  collection_rate_pct: number;
}

interface ReliabilityRow {
  metric_date: string;
  success_rate_pct: number;
  proxy_adoption_pct: number;
  stealth_adoption_pct: number;
}

interface OpsRow {
  metric_date: string;
  total_sessions: number;
}

interface PipelineSnapshot {
  as_of_date: string;
  open_pipeline_usd: number;
  won_revenue_usd: number;
  lead_conversion_rate_pct: number;
  opportunity_win_rate_pct: number;
  leads_total: number;
  opportunities_total: number;
}

interface MixRow {
  plan: string;
  mrr_usd: number;
  share_pct: number;
}

interface EquityRow {
  organization_id: string;
  ticker: string;
  organization_name: string;
  realized_revenue_usd: number;
  pending_revenue_usd: number;
  collection_rate_pct: number;
  reliability_pct: number;
  risk_score: number;
  momentum_score: number;
}

interface TypeaheadItem {
  key: string;
  kind: 'function' | 'market' | 'account';
  label: string;
  hint: string;
  fn?: TerminalFn;
}

const FUNCTIONS: FunctionSpec[] = [
  {
    key: 'MKT',
    name: 'Markets',
    desc: 'Product lines as market indices',
    objective: 'Track which product markets are growing and where revenue is concentrating.',
    action: 'Reallocate GTM effort to the strongest momentum market.',
    source: 'fin.snap_mrr + fin.agg_revenue_monthly',
  },
  {
    key: 'NEWS',
    name: 'System News',
    desc: 'Real-time business event feed',
    objective: 'Surface signup velocity, risk spikes, and operational changes in one tape.',
    action: 'Acknowledge high-severity events and route to owners.',
    source: 'gtm.agg_growth_daily + gtm.signal_trial_conversion_risk_daily + gtm.growth_task_queue',
  },
  {
    key: 'PIPE',
    name: 'Pipeline',
    desc: 'Open pipeline and conversion health',
    objective: 'Watch conversion efficiency across the full GTM funnel.',
    action: 'Prioritize reps/segments with highest win-probability leverage.',
    source: 'gtm.snap_pipeline_daily + gtm.agg_growth_daily',
  },
  {
    key: 'RISK',
    name: 'Risk',
    desc: 'Trial conversion risk monitor',
    objective: 'Identify who is least likely to convert before trial expiry.',
    action: 'Trigger targeted intervention by reason code and urgency.',
    source: 'gtm.signal_trial_conversion_risk_daily',
  },
  {
    key: 'RELI',
    name: 'Reliability',
    desc: 'Product success/failure quality',
    objective: 'Monitor run success and feature reliability impacting conversion.',
    action: 'Escalate degradation events that correlate with trial risk.',
    source: 'pro.agg_product_daily + pro.kpi_product',
  },
  {
    key: 'MIX',
    name: 'Product Mix',
    desc: 'Plan and feature composition',
    objective: 'Understand monetization mix across starter/pro/enterprise.',
    action: 'Tune packaging and pricing to improve expansion and ARPA.',
    source: 'fin.snap_mrr + pro.agg_product_daily',
  },
  {
    key: 'CAMP',
    name: 'Campaigns',
    desc: 'Channel and ROAS board',
    objective: 'Rank campaigns by won revenue and efficiency.',
    action: 'Shift budget from low-ROAS to high-converting channels.',
    source: 'gtm.agg_campaign_channel_monthly',
  },
  {
    key: 'FIN',
    name: 'Finance',
    desc: 'Revenue and collections velocity',
    objective: 'Track realized vs pending revenue and collection quality.',
    action: 'Push collection plays where pending revenue is elevated.',
    source: 'fin.agg_revenue_monthly + fin.snap_mrr',
  },
  {
    key: 'PLAY',
    name: 'Playbook',
    desc: 'Intervention execution queue',
    objective: 'Run and prioritize growth actions by expected impact.',
    action: 'Execute top urgent plays and measure conversion lift.',
    source: 'gtm.growth_task_queue',
  },
  {
    key: 'OPS',
    name: 'Ops',
    desc: 'System throughput and utilization',
    objective: 'Monitor operational load and stability tied to GTM outcomes.',
    action: 'Prevent reliability regressions during demand spikes.',
    source: 'ops.agg_ops_daily + ops.kpi_ops',
  },
];

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function severityVariant(level: EventRow['severity']): 'error' | 'warning' | 'neutral' {
  if (level === 'high') return 'error';
  if (level === 'medium') return 'warning';
  return 'neutral';
}

function priorityVariant(level: QueueRow['priority']): 'error' | 'warning' | 'neutral' {
  if (level === 'urgent') return 'error';
  if (level === 'high') return 'warning';
  return 'neutral';
}

function CubeMark() {
  return (
    <div className="relative h-8 w-8">
      <div className="absolute left-0 top-2 h-4 w-4 bg-accent" />
      <div className="absolute left-3 top-0 h-4 w-4 bg-content-primary" />
      <div className="absolute left-3 top-4 h-4 w-4 bg-accent-hover" />
    </div>
  );
}

function formatChartValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(1);
}

function TimeSeriesChart({ points, colorClass = 'text-accent' }: { points: TrendPoint[]; colorClass?: string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length < 2) {
    return <div className="h-72 rounded-md border border-border bg-surface-primary" />;
  }

  const width = 920;
  const height = 320;
  const padLeft = 56;
  const padRight = 18;
  const padTop = 20;
  const padBottom = 30;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const toX = (idx: number) => padLeft + (idx / (points.length - 1)) * (width - padLeft - padRight);
  const toY = (value: number) => height - padBottom - ((value - min) / range) * (height - padTop - padBottom);

  const polyline = points.map((p, idx) => `${toX(idx)},${toY(p.value)}`).join(' ');
  const area = `${toX(0)},${height - padBottom} ${polyline} ${toX(points.length - 1)},${height - padBottom}`;

  const midIdx = Math.floor(points.length / 2);
  const gridTicks = 5;
  const activeIdx = hoverIndex ?? points.length - 1;
  const activeValue = values[activeIdx];
  const previous = activeIdx > 0 ? values[activeIdx - 1] : values[activeIdx];
  const delta = activeValue - previous;
  const deltaPct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : 0;
  const activeX = toX(activeIdx);
  const activeY = toY(activeValue);

  const tooltipWidth = 180;
  const tooltipHeight = 46;
  const tooltipX = Math.min(Math.max(activeX + 10, padLeft), width - tooltipWidth - 8);
  const tooltipY = Math.max(activeY - tooltipHeight - 10, 8);

  const handleMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * width;
    const raw = ((relativeX - padLeft) / (width - padLeft - padRight)) * (points.length - 1);
    const nextIdx = Math.max(0, Math.min(points.length - 1, Math.round(raw)));
    setHoverIndex(nextIdx);
  };

  return (
    <div className="rounded-md border border-border bg-surface-primary p-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-72 w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {Array.from({ length: gridTicks + 1 }).map((_, idx) => {
          const y = padTop + (idx / gridTicks) * (height - padTop - padBottom);
          const tickValue = max - (idx / gridTicks) * range;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--border-primary)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-tertiary)"
              >
                {formatChartValue(tickValue)}
              </text>
            </g>
          );
        })}
        <line
          x1={toX(midIdx)}
          y1={padTop}
          x2={toX(midIdx)}
          y2={height - padBottom}
          stroke="var(--border-primary)"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
        <polygon points={area} fill="rgba(232,67,42,0.10)" />
        <polyline className={colorClass} points={polyline} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        <line
          x1={activeX}
          y1={padTop}
          x2={activeX}
          y2={height - padBottom}
          stroke="var(--accent-primary)"
          strokeDasharray="4 3"
          strokeWidth="1.5"
          opacity="0.65"
        />
        <circle cx={activeX} cy={activeY} r="4.5" fill="currentColor" className={colorClass} />
        <rect
          x={tooltipX}
          y={tooltipY}
          width={tooltipWidth}
          height={tooltipHeight}
          rx={6}
          fill="var(--bg-elevated)"
          stroke="var(--border-primary)"
        />
        <text x={tooltipX + 10} y={tooltipY + 16} fontSize="10" fill="var(--text-tertiary)">
          {points[activeIdx].label}
        </text>
        <text x={tooltipX + 10} y={tooltipY + 32} fontSize="12" fill="var(--text-primary)">
          {formatChartValue(activeValue)}
        </text>
        <text
          x={tooltipX + tooltipWidth - 10}
          y={tooltipY + 32}
          textAnchor="end"
          fontSize="11"
          fill={delta >= 0 ? 'var(--success)' : 'var(--error)'}
        >
          {delta >= 0 ? '+' : ''}
          {formatChartValue(delta)} ({deltaPct >= 0 ? '+' : ''}
          {deltaPct.toFixed(1)}%)
        </text>
      </svg>
      <div className="mt-2 grid grid-cols-3 text-xs text-content-tertiary">
        <span>{points[0].label}</span>
        <span className="text-center">{points[activeIdx].label}</span>
        <span className="text-right">{points[points.length - 1].label}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className="text-content-tertiary">Min {formatChartValue(min)}</span>
        <span className={`font-medium ${colorClass}`}>
          Value {formatChartValue(activeValue)}{' '}
          <span className={delta >= 0 ? 'text-success' : 'text-error'}>
            ({delta >= 0 ? '+' : ''}
            {formatChartValue(delta)} / {deltaPct >= 0 ? '+' : ''}
            {deltaPct.toFixed(1)}%)
          </span>
        </span>
        <span className="text-content-tertiary">Max {formatChartValue(max)}</span>
      </div>
    </div>
  );
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

async function runQuerySafe(sql: string): Promise<Record<string, unknown>[]> {
  try {
    return await runQuery(sql);
  } catch {
    return [];
  }
}

export default function GTMTerminalPage() {
  const [activeFn, setActiveFn] = useState<TerminalFn>('MKT');
  const [search, setSearch] = useState('');
  const [showTypeahead, setShowTypeahead] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWidget, setExpandedWidget] = useState<WidgetKey | null>(null);

  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [markets, setMarkets] = useState<ProductMarketRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [financeRows, setFinanceRows] = useState<FinanceRow[]>([]);
  const [reliabilityRows, setReliabilityRows] = useState<ReliabilityRow[]>([]);
  const [opsRows, setOpsRows] = useState<OpsRow[]>([]);
  const [mixRows, setMixRows] = useState<MixRow[]>([]);
  const [topEquities, setTopEquities] = useState<EquityRow[]>([]);

  const [marketTrend, setMarketTrend] = useState<TrendPoint[]>([]);
  const [newsTrend, setNewsTrend] = useState<TrendPoint[]>([]);
  const [pipelineTrend, setPipelineTrend] = useState<TrendPoint[]>([]);
  const [riskTrend, setRiskTrend] = useState<TrendPoint[]>([]);
  const [reliabilityTrend, setReliabilityTrend] = useState<TrendPoint[]>([]);
  const [mixTrend, setMixTrend] = useState<TrendPoint[]>([]);
  const [campaignTrend, setCampaignTrend] = useState<TrendPoint[]>([]);
  const [financeTrend, setFinanceTrend] = useState<TrendPoint[]>([]);
  const [playTrend, setPlayTrend] = useState<TrendPoint[]>([]);
  const [opsTrend, setOpsTrend] = useState<TrendPoint[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [
          pipelineRows,
          mrrRows,
          monthlyRevenueRows,
          growthRows,
          riskRows,
          queueRows,
          campaignRows,
          productDailyRows,
          opsDailyRows,
          financeTopRows,
        ] = await Promise.all([
          runQuery(`
            SELECT as_of_date, open_pipeline_usd, won_revenue_usd, lead_conversion_rate_pct, opportunity_win_rate_pct, leads_total, opportunities_total
            FROM gtm.snap_pipeline_daily
            ORDER BY as_of_date DESC
            LIMIT 1
          `),
          runQuerySafe(`
            SELECT as_of_date, total_mrr_usd, starter_mrr_usd, pro_mrr_usd, enterprise_mrr_usd
            FROM fin.snap_mrr
            ORDER BY as_of_date DESC
            LIMIT 1
          `),
          runQuerySafe(`
            SELECT revenue_month, SUM(realized_revenue_usd) AS realized_revenue_usd
            FROM fin.agg_revenue_monthly
            GROUP BY revenue_month
            ORDER BY revenue_month DESC
            LIMIT 12
          `),
          runQuerySafe(`
            SELECT metric_date, new_organizations, new_users, total_sessions, activation_rate_7d_pct
            FROM gtm.agg_growth_daily
            ORDER BY metric_date DESC
            LIMIT 45
          `),
          runQuerySafe(`
            SELECT organization_id, organization_name, signal_score, reason_code, days_remaining_in_trial, success_rate_7d, total_runs_7d
            FROM gtm.signal_trial_conversion_risk_daily
            ORDER BY signal_score DESC, days_remaining_in_trial ASC
            LIMIT 80
          `),
          runQuerySafe(`
            SELECT organization_id, organization_name, priority, reason_code, signal_score
            FROM gtm.growth_task_queue
            ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, signal_score DESC
            LIMIT 80
          `),
          runQuerySafe(`
            SELECT metric_month, campaign_name, channel, won_revenue_usd, campaign_roas
            FROM gtm.agg_campaign_channel_monthly
            ORDER BY metric_month DESC, won_revenue_usd DESC
            LIMIT 80
          `),
          runQuerySafe(`
            SELECT metric_date, success_rate_pct, proxy_adoption_pct, stealth_adoption_pct
            FROM pro.agg_product_daily
            ORDER BY metric_date DESC
            LIMIT 45
          `),
          runQuerySafe(`
            SELECT metric_date, total_sessions
            FROM ops.agg_ops_daily
            ORDER BY metric_date DESC
            LIMIT 45
          `),
          runQuerySafe(`
            SELECT organization_id, revenue_month, organization_name, current_plan_name, realized_revenue_usd, pending_revenue_usd, collection_rate_pct
            FROM fin.agg_revenue_monthly
            ORDER BY revenue_month DESC, realized_revenue_usd DESC
            LIMIT 80
          `),
        ]);

        const snapshot = pipelineRows[0];
        if (!snapshot) {
          throw new Error('No pipeline snapshot found in gtm.snap_pipeline_daily');
        }

        setPipeline({
          as_of_date: String(snapshot.as_of_date ?? ''),
          open_pipeline_usd: toNumber(snapshot.open_pipeline_usd),
          won_revenue_usd: toNumber(snapshot.won_revenue_usd),
          lead_conversion_rate_pct: toNumber(snapshot.lead_conversion_rate_pct),
          opportunity_win_rate_pct: toNumber(snapshot.opportunity_win_rate_pct),
          leads_total: toNumber(snapshot.leads_total),
          opportunities_total: toNumber(snapshot.opportunities_total),
        });

        const mrr = mrrRows[0];
        const currentRevenue = toNumber(monthlyRevenueRows[0]?.realized_revenue_usd);
        const previousRevenue = toNumber(monthlyRevenueRows[1]?.realized_revenue_usd);
        const tsiChangePct =
          previousRevenue > 0
            ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
            : null;

        const localMarkets: ProductMarketRow[] = mrr
          ? [
              { market: 'Starter Market', ticker: 'STR', value: toNumber(mrr.starter_mrr_usd), change_pct: null },
              { market: 'Pro Market', ticker: 'PRO', value: toNumber(mrr.pro_mrr_usd), change_pct: null },
              { market: 'Enterprise Market', ticker: 'ENT', value: toNumber(mrr.enterprise_mrr_usd), change_pct: null },
              { market: 'Total Subscription Index', ticker: 'TSI', value: toNumber(mrr.total_mrr_usd), change_pct: tsiChangePct },
            ]
          : [];
        setMarkets(localMarkets);

        const localRisks: RiskRow[] = riskRows.map((row) => ({
          organization_id: String(row.organization_id ?? ''),
          organization_name: String(row.organization_name ?? ''),
          signal_score: toNumber(row.signal_score),
          reason_code: String(row.reason_code ?? ''),
          days_remaining_in_trial: toNumber(row.days_remaining_in_trial),
          success_rate_7d: toNumber(row.success_rate_7d),
          total_runs_7d: toNumber(row.total_runs_7d),
        }));
        setRisks(localRisks);

        const localQueue: QueueRow[] = queueRows.map((row) => ({
          organization_id: String(row.organization_id ?? ''),
          organization_name: String(row.organization_name ?? ''),
          priority: String(row.priority ?? 'normal') as QueueRow['priority'],
          reason_code: String(row.reason_code ?? ''),
          signal_score: toNumber(row.signal_score),
        }));
        setQueue(localQueue);

        const localCampaigns: CampaignRow[] = campaignRows.map((row) => ({
          metric_month: String(row.metric_month ?? ''),
          campaign_name: String(row.campaign_name ?? ''),
          channel: String(row.channel ?? ''),
          won_revenue_usd: toNumber(row.won_revenue_usd),
          campaign_roas: row.campaign_roas == null ? null : toNumber(row.campaign_roas),
        }));
        setCampaigns(localCampaigns);

        const localReliability: ReliabilityRow[] = productDailyRows.map((row) => ({
          metric_date: String(row.metric_date ?? ''),
          success_rate_pct: toNumber(row.success_rate_pct),
          proxy_adoption_pct: toNumber(row.proxy_adoption_pct),
          stealth_adoption_pct: toNumber(row.stealth_adoption_pct),
        }));
        setReliabilityRows(localReliability);

        const localOps: OpsRow[] = opsDailyRows.map((row) => ({
          metric_date: String(row.metric_date ?? ''),
          total_sessions: toNumber(row.total_sessions),
        }));
        setOpsRows(localOps);

        const localFinance: FinanceRow[] = financeTopRows.map((row) => ({
          organization_id: String(row.organization_id ?? ''),
          revenue_month: String(row.revenue_month ?? ''),
          organization_name: String(row.organization_name ?? ''),
          current_plan_name: String(row.current_plan_name ?? ''),
          realized_revenue_usd: toNumber(row.realized_revenue_usd),
          pending_revenue_usd: toNumber(row.pending_revenue_usd),
          collection_rate_pct: toNumber(row.collection_rate_pct),
        }));
        setFinanceRows(localFinance);

        const riskByOrg = new Map<string, RiskRow>();
        for (const risk of localRisks) {
          if (!risk.organization_id) continue;
          if (!riskByOrg.has(risk.organization_id)) {
            riskByOrg.set(risk.organization_id, risk);
          }
        }

        const equityRows: EquityRow[] = localFinance.slice(0, 120).map((row) => {
          const matchedRisk = riskByOrg.get(row.organization_id);
          const reliability = matchedRisk ? matchedRisk.success_rate_7d * 100 : 70;
          const riskScore = matchedRisk ? matchedRisk.signal_score * 100 : 35;
          const momentumScore = Math.max(
            0,
            Math.min(100, reliability * 0.5 + row.collection_rate_pct * 0.35 + (100 - riskScore) * 0.15),
          );
          return {
            organization_id: row.organization_id,
            ticker: row.organization_name
              .split(' ')
              .filter(Boolean)
              .slice(0, 3)
              .map((part) => part[0]?.toUpperCase() || '')
              .join('')
              .slice(0, 4) || 'N/A',
            organization_name: row.organization_name,
            realized_revenue_usd: row.realized_revenue_usd,
            pending_revenue_usd: row.pending_revenue_usd,
            collection_rate_pct: row.collection_rate_pct,
            reliability_pct: reliability,
            risk_score: riskScore,
            momentum_score: momentumScore,
          };
        });

        setTopEquities(
          equityRows
            .sort((a, b) => b.realized_revenue_usd - a.realized_revenue_usd)
            .slice(0, 100),
        );

        if (mrr) {
          const total = toNumber(mrr.total_mrr_usd) || 1;
          setMixRows([
            { plan: 'starter', mrr_usd: toNumber(mrr.starter_mrr_usd), share_pct: (toNumber(mrr.starter_mrr_usd) / total) * 100 },
            { plan: 'pro', mrr_usd: toNumber(mrr.pro_mrr_usd), share_pct: (toNumber(mrr.pro_mrr_usd) / total) * 100 },
            { plan: 'enterprise', mrr_usd: toNumber(mrr.enterprise_mrr_usd), share_pct: (toNumber(mrr.enterprise_mrr_usd) / total) * 100 },
          ]);
        } else {
          setMixRows([]);
        }

        const topRisk = localRisks[0];
        const topQueue = localQueue[0];
        const growthRecent = [...growthRows].reverse();

        const generatedEvents: EventRow[] = growthRecent.slice(-8).map((row) => ({
          time: shortDate(String(row.metric_date ?? '')),
          headline: `${toNumber(row.new_organizations)} orgs · ${toNumber(row.new_users)} users`,
          detail: `Activation ${formatPct(toNumber(row.activation_rate_7d_pct))}`,
          severity: toNumber(row.new_organizations) >= 3 ? 'low' : 'medium',
        }));

        if (topQueue) {
          generatedEvents.unshift({
            time: 'Now',
            headline: `${topQueue.priority.toUpperCase()} play: ${topQueue.organization_name}`,
            detail: `${topQueue.reason_code} · risk ${(topQueue.signal_score * 100).toFixed(0)}`,
            severity: topQueue.priority === 'urgent' ? 'high' : 'medium',
          });
        }

        if (topRisk) {
          generatedEvents.unshift({
            time: 'Now',
            headline: `${topRisk.organization_name} risk spike ${(topRisk.signal_score * 100).toFixed(0)}`,
            detail: `${topRisk.reason_code} · ${topRisk.days_remaining_in_trial} days left`,
            severity: topRisk.signal_score >= 0.85 ? 'high' : 'medium',
          });
        }

        setEvents(generatedEvents.slice(0, 12));

        setMarketTrend(
          [...monthlyRevenueRows]
            .reverse()
            .map((row) => ({ label: shortDate(String(row.revenue_month ?? '')), value: toNumber(row.realized_revenue_usd) })),
        );
        setNewsTrend(growthRecent.map((row) => ({ label: shortDate(String(row.metric_date ?? '')), value: toNumber(row.new_organizations) })));
        setPipelineTrend(growthRecent.map((row) => ({ label: shortDate(String(row.metric_date ?? '')), value: toNumber(row.total_sessions) })));
        setRiskTrend(localRisks.slice(0, 30).reverse().map((row, idx) => ({ label: String(idx + 1), value: row.signal_score * 100 })));
        setReliabilityTrend([...localReliability].reverse().map((row) => ({ label: shortDate(row.metric_date), value: row.success_rate_pct })));
        setMixTrend([...localReliability].reverse().map((row) => ({ label: shortDate(row.metric_date), value: row.proxy_adoption_pct + row.stealth_adoption_pct })));
        setCampaignTrend(
          [...localCampaigns]
            .slice(0, 30)
            .reverse()
            .map((row) => ({ label: shortDate(row.metric_month), value: row.won_revenue_usd })),
        );
        setFinanceTrend(
          [...monthlyRevenueRows]
            .reverse()
            .map((row) => ({ label: shortDate(String(row.revenue_month ?? '')), value: toNumber(row.realized_revenue_usd) })),
        );
        setPlayTrend(localQueue.slice(0, 30).reverse().map((row, idx) => ({ label: String(idx + 1), value: row.signal_score * 100 })));
        setOpsTrend([...localOps].reverse().map((row) => ({ label: shortDate(row.metric_date), value: row.total_sessions })));
      } catch (loadErr) {
        setError(loadErr instanceof Error ? loadErr.message : 'Failed to load terminal data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const typeahead = useMemo<TypeaheadItem[]>(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];

    const fnItems = FUNCTIONS
      .filter((fn) => fn.key.toLowerCase().includes(term) || fn.name.toLowerCase().includes(term))
      .map((fn) => ({ key: `fn-${fn.key}`, kind: 'function' as const, label: `${fn.key} · ${fn.name}`, hint: fn.desc, fn: fn.key }));

    const mktItems = markets
      .filter((row) => row.market.toLowerCase().includes(term) || row.ticker.toLowerCase().includes(term))
      .map((row) => ({ key: `mkt-${row.ticker}`, kind: 'market' as const, label: `${row.ticker} · ${row.market}`, hint: formatUsd(row.value) }));

    const acctItems = risks
      .filter((row) => row.organization_name.toLowerCase().includes(term) || row.reason_code.toLowerCase().includes(term))
      .slice(0, 6)
      .map((row) => ({
        key: `acct-${row.organization_name}`,
        kind: 'account' as const,
        label: row.organization_name,
        hint: `${row.reason_code} · risk ${(row.signal_score * 100).toFixed(0)}`,
      }));

    return [...fnItems, ...mktItems, ...acctItems].slice(0, 12);
  }, [search, markets, risks]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [search]);

  const handleTypeaheadSelect = (item: TypeaheadItem) => {
    if (item.kind === 'function' && item.fn) {
      setActiveFn(item.fn);
      setSearch(item.label);
    } else if (item.kind === 'market') {
      setActiveFn('MKT');
      setSearch(item.label);
    } else {
      setActiveFn('RISK');
      setSearch(item.label);
    }
    setShowTypeahead(false);
  };

  const handleTypeaheadKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showTypeahead || typeahead.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => Math.min(prev + 1, typeahead.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const item = typeahead[activeSuggestionIndex];
      if (item) setSearch(item.label);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const item = typeahead[activeSuggestionIndex];
      if (item) handleTypeaheadSelect(item);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setShowTypeahead(false);
    }
  };

  const activeSpec = useMemo(() => FUNCTIONS.find((f) => f.key === activeFn) || FUNCTIONS[0], [activeFn]);

  const mainSeries = useMemo(() => {
    if (activeFn === 'MKT') return marketTrend;
    if (activeFn === 'NEWS') return newsTrend;
    if (activeFn === 'PIPE') return pipelineTrend;
    if (activeFn === 'RISK') return riskTrend;
    if (activeFn === 'RELI') return reliabilityTrend;
    if (activeFn === 'MIX') return mixTrend;
    if (activeFn === 'CAMP') return campaignTrend;
    if (activeFn === 'FIN') return financeTrend;
    if (activeFn === 'PLAY') return playTrend;
    return opsTrend;
  }, [activeFn, marketTrend, newsTrend, pipelineTrend, riskTrend, reliabilityTrend, mixTrend, campaignTrend, financeTrend, playTrend, opsTrend]);

  const filteredEquities = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return topEquities;
    return topEquities.filter(
      (row) =>
        row.organization_name.toLowerCase().includes(term) ||
        row.ticker.toLowerCase().includes(term),
    );
  }, [search, topEquities]);

  const keyStats = useMemo(() => {
    if (!pipeline) return [];
    return [
      { label: 'Open Pipeline', value: formatUsd(pipeline.open_pipeline_usd) },
      { label: 'Won Revenue', value: formatUsd(pipeline.won_revenue_usd) },
      { label: 'Lead Conv', value: formatPct(pipeline.lead_conversion_rate_pct) },
      { label: 'Win Rate', value: formatPct(pipeline.opportunity_win_rate_pct) },
    ];
  }, [pipeline]);

  const mainTable = useMemo<{ columns: any[]; rows: any[]; empty: string }>(() => {
    if (activeFn === 'MKT') {
      return {
        columns: [
          { key: 'ticker', header: 'Ticker' },
          { key: 'organization_name', header: 'Firm' },
          { key: 'realized_revenue_usd', header: 'Revenue', align: 'right' as const, render: (row: EquityRow) => formatUsd(row.realized_revenue_usd) },
          { key: 'reliability_pct', header: 'Reliability', align: 'right' as const, render: (row: EquityRow) => formatPct(row.reliability_pct) },
          { key: 'risk_score', header: 'Risk', align: 'right' as const, render: (row: EquityRow) => `${row.risk_score.toFixed(0)}` },
          { key: 'momentum_score', header: 'Momentum', align: 'right' as const, render: (row: EquityRow) => `${row.momentum_score.toFixed(0)}` },
          {
            key: 'drill',
            header: 'Drill',
            render: (row: EquityRow) => (
              <Link href={`/customers/${encodeURIComponent(row.organization_id)}`} className="text-accent hover:underline">
                Open
              </Link>
            ),
          },
        ],
        rows: filteredEquities,
        empty: 'No firm rows',
      };
    }

    if (activeFn === 'NEWS') {
      return {
        columns: [
          { key: 'time', header: 'Time' },
          { key: 'headline', header: 'Headline' },
          {
            key: 'severity',
            header: 'Severity',
            render: (row: EventRow) => <Badge variant={severityVariant(row.severity)}>{row.severity}</Badge>,
          },
          { key: 'detail', header: 'Detail' },
        ],
        rows: events,
        empty: 'No system events',
      };
    }

    if (activeFn === 'PIPE') {
      return {
        columns: [
          { key: 'metric', header: 'Metric' },
          { key: 'value', header: 'Value', align: 'right' as const },
        ],
        rows: pipeline
          ? [
              { metric: 'As of', value: pipeline.as_of_date },
              { metric: 'Open Pipeline', value: formatUsd(pipeline.open_pipeline_usd) },
              { metric: 'Won Revenue', value: formatUsd(pipeline.won_revenue_usd) },
              { metric: 'Lead Conversion', value: formatPct(pipeline.lead_conversion_rate_pct) },
              { metric: 'Opportunity Win Rate', value: formatPct(pipeline.opportunity_win_rate_pct) },
              { metric: 'Leads Total', value: String(pipeline.leads_total) },
              { metric: 'Opportunities Total', value: String(pipeline.opportunities_total) },
            ]
          : [],
        empty: 'No pipeline snapshot',
      };
    }

    if (activeFn === 'RISK') {
      return {
        columns: [
          { key: 'organization_name', header: 'Account' },
          { key: 'reason_code', header: 'Driver' },
          { key: 'days_remaining_in_trial', header: 'Days Left', align: 'right' as const },
          {
            key: 'success_rate_7d',
            header: 'Success %',
            align: 'right' as const,
            render: (row: RiskRow) => formatPct(row.success_rate_7d * 100),
          },
          {
            key: 'signal_score',
            header: 'Risk',
            align: 'right' as const,
            render: (row: RiskRow) => `${(row.signal_score * 100).toFixed(0)}`,
          },
        ],
        rows: risks.slice(0, 40),
        empty: 'No risk rows',
      };
    }

    if (activeFn === 'RELI') {
      return {
        columns: [
          { key: 'metric_date', header: 'Date' },
          { key: 'success_rate_pct', header: 'Success %', align: 'right' as const, render: (row: ReliabilityRow) => formatPct(row.success_rate_pct) },
          { key: 'proxy_adoption_pct', header: 'Proxy %', align: 'right' as const, render: (row: ReliabilityRow) => formatPct(row.proxy_adoption_pct) },
          { key: 'stealth_adoption_pct', header: 'Stealth %', align: 'right' as const, render: (row: ReliabilityRow) => formatPct(row.stealth_adoption_pct) },
        ],
        rows: reliabilityRows.slice(0, 30),
        empty: 'No reliability rows',
      };
    }

    if (activeFn === 'MIX') {
      return {
        columns: [
          { key: 'plan', header: 'Plan' },
          { key: 'mrr_usd', header: 'MRR', align: 'right' as const, render: (row: MixRow) => formatUsd(row.mrr_usd) },
          { key: 'share_pct', header: 'Share %', align: 'right' as const, render: (row: MixRow) => formatPct(row.share_pct) },
        ],
        rows: mixRows,
        empty: 'No plan mix data',
      };
    }

    if (activeFn === 'CAMP') {
      return {
        columns: [
          { key: 'metric_month', header: 'Month' },
          { key: 'campaign_name', header: 'Campaign' },
          { key: 'channel', header: 'Channel' },
          { key: 'won_revenue_usd', header: 'Won', align: 'right' as const, render: (row: CampaignRow) => formatUsd(row.won_revenue_usd) },
          {
            key: 'campaign_roas',
            header: 'ROAS',
            align: 'right' as const,
            render: (row: CampaignRow) => (row.campaign_roas == null ? 'n/a' : row.campaign_roas.toFixed(2)),
          },
        ],
        rows: campaigns.slice(0, 40),
        empty: 'Campaign model unavailable',
      };
    }

    if (activeFn === 'FIN') {
      return {
        columns: [
          { key: 'revenue_month', header: 'Month' },
          { key: 'organization_name', header: 'Account' },
          { key: 'current_plan_name', header: 'Plan' },
          { key: 'realized_revenue_usd', header: 'Realized', align: 'right' as const, render: (row: FinanceRow) => formatUsd(row.realized_revenue_usd) },
          { key: 'pending_revenue_usd', header: 'Pending', align: 'right' as const, render: (row: FinanceRow) => formatUsd(row.pending_revenue_usd) },
          { key: 'collection_rate_pct', header: 'Collection %', align: 'right' as const, render: (row: FinanceRow) => formatPct(row.collection_rate_pct) },
        ],
        rows: financeRows.slice(0, 40),
        empty: 'No finance rows',
      };
    }

    if (activeFn === 'PLAY') {
      return {
        columns: [
          { key: 'organization_name', header: 'Account' },
          { key: 'reason_code', header: 'Reason' },
          { key: 'priority', header: 'Priority', render: (row: QueueRow) => <Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge> },
          { key: 'signal_score', header: 'Risk', align: 'right' as const, render: (row: QueueRow) => `${(row.signal_score * 100).toFixed(0)}` },
        ],
        rows: queue.slice(0, 40),
        empty: 'No queued plays',
      };
    }

    return {
      columns: [
        { key: 'metric_date', header: 'Date' },
        { key: 'total_sessions', header: 'Sessions', align: 'right' as const },
      ],
      rows: opsRows.slice(0, 40),
      empty: 'No ops rows',
    };
  }, [activeFn, events, pipeline, filteredEquities, risks, reliabilityRows, mixRows, campaigns, financeRows, queue, opsRows]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-secondary p-6 text-content-primary">
        <LoadingState title="Initializing GTMT" description="Loading function feeds, charts, and decision tables." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-secondary p-6 text-content-primary">
        <EmptyState title="GTMT unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </div>
    );
  }

  const renderMainWidget = () => (
    <div className="rounded-md border border-border bg-surface-elevated p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-content-tertiary">{activeSpec.key} · {activeSpec.name}</p>
          <p className="text-sm text-content-primary">{activeSpec.objective}</p>
          <p className="text-xs text-content-secondary">Action: {activeSpec.action}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setExpandedWidget('main')}>Expand</Button>
      </div>
      <TimeSeriesChart points={mainSeries} colorClass={activeFn === 'RISK' ? 'text-warning' : activeFn === 'RELI' ? 'text-success' : 'text-accent'} />
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {keyStats.map((stat) => (
          <div key={stat.label} className="rounded border border-border bg-surface-primary px-2 py-1.5">
            <p className="text-[11px] text-content-tertiary">{stat.label}</p>
            <p className="text-sm font-semibold text-content-primary">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded border border-border bg-surface-primary p-2">
        <p className="text-[11px] text-content-tertiary">Source</p>
        <p className="text-xs text-content-secondary">{activeSpec.source}</p>
      </div>
    </div>
  );

  const renderNewsWidget = () => (
    <div className="rounded-md border border-border bg-surface-elevated p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-content-tertiary">System News</p>
        <Button size="sm" variant="secondary" onClick={() => setExpandedWidget('news')}>Expand</Button>
      </div>
      <div className="space-y-2">
        {events.slice(0, 9).map((event, idx) => (
          <div key={`${event.headline}-${idx}`} className="rounded border border-border bg-surface-primary px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-content-primary">{event.headline}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-content-tertiary">{event.time}</span>
                <Badge variant={severityVariant(event.severity)}>{event.severity}</Badge>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-content-tertiary">{event.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBlotterWidget = () => (
    <div className="rounded-md border border-border bg-surface-elevated p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-content-tertiary">Action Blotter</p>
        <Button size="sm" variant="secondary" onClick={() => setExpandedWidget('blotter')}>Expand</Button>
      </div>
      <div className="space-y-2">
        {queue.slice(0, 8).map((row, idx) => (
          <div key={`${row.organization_name}-${idx}`} className="rounded border border-border bg-surface-primary p-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-content-primary truncate">{row.organization_name}</p>
              <Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge>
            </div>
            <p className="mt-1 text-[11px] text-content-tertiary">{row.reason_code}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-content-tertiary">risk {(row.signal_score * 100).toFixed(0)}</span>
              <Button size="sm" variant="ghost">Run</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-surface-secondary text-content-primary"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(209,213,219,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(209,213,219,0.45) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <div className="grid min-h-screen grid-cols-[220px_1fr]">
        <aside className="border-r border-accent-active bg-accent p-3 text-white">
          <div className="mb-3 flex items-center gap-2 rounded border border-white/25 bg-white/10 px-2 py-2">
            <CubeMark />
            <div>
              <p className="text-sm font-semibold leading-none">GTMT</p>
              <p className="mt-1 text-xs text-white/80">GTM Market Terminal</p>
            </div>
          </div>

          <div className="space-y-1">
            {FUNCTIONS.map((fn) => (
              <button
                key={fn.key}
                onClick={() => {
                  setActiveFn(fn.key);
                  setSearch('');
                  setShowTypeahead(false);
                }}
                className={`w-full rounded px-2 py-2 text-left text-xs transition-colors ${
                  activeFn === fn.key
                    ? 'border border-white/40 bg-white/20 text-white'
                    : 'border border-white/20 bg-white/10 text-white/90 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{fn.key}</span>
                  <span className="text-[10px] text-white/70">{fn.name}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded border border-white/20 bg-white/10 p-2">
            <p className="text-[11px] uppercase tracking-wide text-white/75">As Of</p>
            <p className="text-xs text-white">{pipeline ? shortDate(pipeline.as_of_date) : 'n/a'}</p>
          </div>
        </aside>

        <main className="p-3">
          <div className="mb-3 flex items-center justify-between rounded border border-border bg-surface-primary px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CubeMark />
                <div>
                  <p className="text-sm font-semibold">{activeSpec.name}</p>
                  <p className="text-xs text-content-tertiary">{activeSpec.desc}</p>
                </div>
              </div>
            </div>

            <div className="mx-3 w-full max-w-xl">
              <div className="relative">
                <SearchInput
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setShowTypeahead(true);
                  }}
                  onKeyDown={handleTypeaheadKeyDown}
                  onFocus={() => setShowTypeahead(true)}
                  onBlur={() => setTimeout(() => setShowTypeahead(false), 120)}
                  placeholder="Search function, ticker, account, or reason"
                />
                {showTypeahead && search.trim().length > 0 ? (
                  <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface-elevated shadow-medium">
                    {typeahead.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-content-tertiary">No matches</div>
                    ) : (
                      typeahead.map((item, idx) => (
                        <button
                          key={item.key}
                          className={`w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-tertiary ${
                            idx === activeSuggestionIndex ? 'bg-surface-tertiary' : ''
                          }`}
                          onMouseDown={() => handleTypeaheadSelect(item)}
                        >
                          <p className="text-xs font-medium text-content-primary">{item.label}</p>
                          <p className="text-[11px] text-content-tertiary">{item.hint}</p>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 text-xs text-content-tertiary">
              <span className="hidden md:inline">Markets are products</span>
              <Badge variant="accent">LIVE</Badge>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded border border-border bg-surface-elevated px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-content-tertiary">Function Objective</p>
              <p className="mt-1 text-sm text-content-primary">{activeSpec.objective}</p>
            </div>
            <div className="rounded border border-border bg-surface-elevated px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-content-tertiary">Operator Action</p>
              <p className="mt-1 text-sm text-content-primary">{activeSpec.action}</p>
            </div>
            <div className="rounded border border-border bg-surface-elevated px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-content-tertiary">Data Source</p>
              <p className="mt-1 text-sm text-content-primary">{activeSpec.source}</p>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <section className="col-span-12 xl:col-span-8">{renderMainWidget()}</section>
            <section className="col-span-12 xl:col-span-4">{renderNewsWidget()}</section>
            <section className="col-span-12"> 
              <div className="rounded-md border border-border bg-surface-elevated p-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-content-tertiary">Decision Table · {activeSpec.key}</p>
                <DataTable columns={mainTable.columns} rows={mainTable.rows} emptyLabel={mainTable.empty} />
              </div>
            </section>
            <section className="col-span-12 xl:col-span-4">{renderBlotterWidget()}</section>
          </div>
        </main>
      </div>

      {expandedWidget ? (
        <div className="fixed inset-0 z-50 bg-surface-secondary/95 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-content-primary">Widget: {expandedWidget.toUpperCase()}</p>
            <Button variant="secondary" onClick={() => setExpandedWidget(null)}>Close</Button>
          </div>
          <div className="h-[calc(100vh-88px)] overflow-auto">
            {expandedWidget === 'main' && renderMainWidget()}
            {expandedWidget === 'news' && renderNewsWidget()}
            {expandedWidget === 'blotter' && renderBlotterWidget()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
