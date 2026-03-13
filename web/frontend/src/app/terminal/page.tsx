'use client';

import { Fragment, KeyboardEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  LoadingState,
  SearchInput,
} from '@/components/ui';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';
import TerminalShell from '@/components/terminal/TerminalShell';
import { findTerminalFunction, resolveTerminalCommandHref, VISIBLE_TERMINAL_FUNCTIONS } from '@/lib/terminalFunctions';

interface SummaryRow {
  revenue_usd: number;
  spend_usd: number;
  total_runs: number;
  successful_runs: number;
  new_leads: number;
  new_opportunities: number;
  won_opportunities: number;
  pipeline_open_usd: number;
  mrr_usd: number;
  ap_open_usd: number;
}

interface TrendRow {
  month_start: string;
  revenue_usd: number;
  spend_usd: number;
  total_runs: number;
  successful_runs: number;
  new_opportunities: number;
  won_opportunities: number;
}

interface OrgSnapshotRow {
  organization_id: string;
  organization_name: string;
  current_plan_name: string;
  organization_status: string;
  recognized_revenue_usd: number;
  total_spend_usd: number;
  total_runs: number;
  successful_runs: number;
  success_rate_pct: number;
  new_opportunities: number;
  won_opportunities: number;
  pipeline_open_usd: number;
  mrr_usd: number;
  gross_margin_proxy_usd: number;
  mom_revenue_growth_pct: number;
  mom_runs_growth_pct: number;
  mom_spend_growth_pct: number;
}

interface Suggestion {
  key: string;
  label: string;
  hint: string;
  action: () => void;
}

interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

type RangeKey = 'THIS_MONTH' | 'LAST_QUARTER' | 'LAST_6_MONTHS' | 'LAST_12_MONTHS';
type ScoreboardGroup = 'Financial' | 'Product' | 'GTM';
type SignalKind = 'Expansion candidate' | 'Conversion candidate' | 'At risk' | 'Inactive' | 'High usage' | 'Stable';

interface MetricCardConfig {
  label: string;
  value: string;
  delta: string;
  tone: 'positive' | 'negative' | 'neutral';
  href?: string;
}

interface ScoreboardRow {
  label: string;
  group: ScoreboardGroup;
  values: number[];
  formatter: (value: number) => string;
  positiveGood?: boolean;
}

interface CustomerSignalRow {
  organization_id: string;
  organization_name: string;
  current_plan_name: string;
  revenue: number;
  runs: number;
  success_rate_pct: number;
  signal: SignalKind;
  detail: string;
  score: number;
}

interface HealthSummary {
  status: 'Stable' | 'Watch' | 'At Risk';
  reason: string;
}

function isCustomerCommand(query: string): boolean {
  return /^(?:cus|cust|cuss|customer)(?:[\s.]|$)/i.test(query.trim());
}

function shortMonth(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(1);
}

function asPct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function changePct(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function deltaLabel(current: number, previous: number, invert = false): { text: string; tone: MetricCardConfig['tone'] } {
  const delta = changePct(current, previous);
  if (!Number.isFinite(delta)) return { text: 'No prior period', tone: 'neutral' };
  if (Math.abs(delta) < 0.1) return { text: 'Flat vs prior month', tone: 'neutral' };
  const improved = invert ? delta <= 0 : delta >= 0;
  return {
    text: `${delta >= 0 ? '↑' : '↓'} ${pct(Math.abs(delta))} vs prior month`,
    tone: improved ? 'positive' : 'negative',
  };
}

function metricToneClass(tone: MetricCardConfig['tone']): string {
  if (tone === 'positive') return 'text-green-600';
  if (tone === 'negative') return 'text-red-500';
  return 'text-content-tertiary';
}

function signalVariant(signal: SignalKind): 'success' | 'warning' | 'error' | 'neutral' {
  if (signal === 'Expansion candidate' || signal === 'High usage') return 'success';
  if (signal === 'Conversion candidate') return 'warning';
  if (signal === 'At risk') return 'error';
  return 'neutral';
}

function signalScore(row: OrgSnapshotRow): CustomerSignalRow {
  const revenue = row.recognized_revenue_usd;
  const runs = row.total_runs;
  const successRate = row.success_rate_pct;
  const isFree = revenue <= 0;
  const lowUsage = runs === 0;
  const heavyUsage = runs >= 250;
  const usageGrowth = row.mom_runs_growth_pct >= 20;
  const revenueGrowth = row.mom_revenue_growth_pct >= 10;
  const poorReliability = successRate > 0 && successRate < 65;

  let signal: SignalKind = 'Stable';
  let detail = 'No material anomaly in the current month.';
  let score = 10;

  if (revenue > 0 && (lowUsage || poorReliability)) {
    signal = 'At risk';
    detail = lowUsage ? 'Revenue present but usage stalled this month.' : `Run success fell to ${pct(successRate)}.`;
    score = 100 + revenue;
  } else if (isFree && heavyUsage) {
    signal = 'Conversion candidate';
    detail = `${runs.toLocaleString()} runs on a non-paying plan.`;
    score = 90 + runs;
  } else if (!isFree && heavyUsage && (usageGrowth || revenueGrowth) && row.current_plan_name.toLowerCase() !== 'enterprise') {
    signal = 'Expansion candidate';
    detail = 'Usage is compounding on a paid plan.';
    score = 80 + revenue + runs;
  } else if (heavyUsage) {
    signal = 'High usage';
    detail = `${runs.toLocaleString()} runs this month.`;
    score = 70 + runs;
  } else if (lowUsage && revenue <= 0) {
    signal = 'Inactive';
    detail = 'No revenue and no automation activity.';
    score = 20;
  }

  return {
    organization_id: row.organization_id,
    organization_name: row.organization_name,
    current_plan_name: row.current_plan_name,
    revenue,
    runs,
    success_rate_pct: successRate,
    signal,
    detail,
    score,
  };
}

function MiniSeriesChart({ labels, series }: { labels: string[]; series: ChartSeries[] }) {
  if (!labels.length || !series.length) {
    return <div className="h-52 rounded-xl border border-border bg-surface-primary" />;
  }

  const width = 760;
  const height = 220;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 28;

  const allValues = series.flatMap((item) => item.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const toX = (index: number) => padL + (index / Math.max(labels.length - 1, 1)) * (width - padL - padR);
  const toY = (value: number) => height - padB - ((value - min) / range) * (height - padT - padB);

  return (
    <div className="rounded-xl border border-border bg-surface-primary p-3">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-content-secondary">
        {series.map((item) => (
          <span key={item.name} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full">
        {Array.from({ length: 5 }).map((_, index) => {
          const y = padT + (index / 4) * (height - padT - padB);
          const tick = max - (index / 4) * range;
          return (
            <g key={index}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--border-primary)" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-tertiary)">
                {formatCompact(tick)}
              </text>
            </g>
          );
        })}
        {series.map((item) => (
          <polyline
            key={item.name}
            points={item.values.map((value, index) => `${toX(index)},${toY(value)}`).join(' ')}
            fill="none"
            stroke={item.color}
            strokeWidth="2.6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-2 grid grid-cols-3 text-xs text-content-tertiary">
        <span>{labels[0]}</span>
        <span className="text-center">{labels[Math.floor(labels.length / 2)]}</span>
        <span className="text-right">{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, delta, tone, onClick }: MetricCardConfig & { onClick?: () => void }) {
  const content = (
    <>
      <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-content-primary">{value}</p>
      <p className={`mt-2 text-xs font-medium ${metricToneClass(tone)}`}>{delta}</p>
    </>
  );

  if (!onClick) {
    return <div className="rounded-2xl border border-border bg-surface-elevated px-4 py-4">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-border bg-surface-elevated px-4 py-4 text-left transition-colors hover:bg-surface-primary"
    >
      {content}
    </button>
  );
}

function RangeToggle({
  active,
  onChange,
}: {
  active: RangeKey;
  onChange: (next: RangeKey) => void;
}) {
  const items: { key: RangeKey; label: string }[] = [
    { key: 'THIS_MONTH', label: 'This Month' },
    { key: 'LAST_QUARTER', label: 'Last Quarter' },
    { key: 'LAST_6_MONTHS', label: 'Last 6 Months' },
    { key: 'LAST_12_MONTHS', label: 'Last 12 Months' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            active === item.key
              ? 'border-teal-600 bg-teal-700/15 text-teal-300'
              : 'border-border bg-surface-primary text-content-secondary hover:bg-surface-tertiary'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function BusinessTerminalOverviewPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [isTrendLoading, setIsTrendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthNotice, setMonthNotice] = useState<string | null>(null);

  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<RangeKey>('LAST_QUARTER');

  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrgSnapshotRow[]>([]);

  const [search, setSearch] = useState('');
  const [showTypeahead, setShowTypeahead] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(search);

  const runFunctionCommand = (raw: string): boolean => {
    const href = resolveTerminalCommandHref(raw.trim());
    if (!href) return false;
    router.push(href);
    return true;
  };

  useEffect(() => {
    async function loadBase() {
      setIsLoading(true);
      setError(null);
      try {
        const monthsRaw = await runWarehouseQuerySafe(`
          SELECT DISTINCT month_start
          FROM term.business_snapshot_monthly
          ORDER BY month_start DESC
          LIMIT 18
        `);

        const months = monthsRaw
          .map((row) => String(row.month_start ?? '').slice(0, 10))
          .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

        if (!months.length) {
          setError('No monthly snapshot rows found in term.business_snapshot_monthly.');
          return;
        }

        setMonthOptions(months);
        const monthParam = new URLSearchParams(window.location.search).get('month') || '';
        const monthPrefix = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : monthParam.slice(0, 7);
        const matchedMonth = monthPrefix ? months.find((month) => month.startsWith(monthPrefix)) : undefined;
        setSelectedMonth(matchedMonth || months[0]);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load overview data.');
      } finally {
        setIsLoading(false);
      }
    }

    loadBase();
  }, []);

  useEffect(() => {
    async function loadTrend() {
      setIsTrendLoading(true);
      try {
        const trendRaw = await runWarehouseQuerySafe(`
          SELECT
            month_start,
            SUM(recognized_revenue_usd) AS revenue_usd,
            SUM(total_spend_usd) AS spend_usd,
            SUM(total_runs) AS total_runs,
            SUM(successful_runs) AS successful_runs,
            SUM(new_opportunities) AS new_opportunities,
            SUM(won_opportunities) AS won_opportunities
          FROM term.business_snapshot_monthly
          GROUP BY 1
          ORDER BY month_start DESC
          LIMIT 12
        `);

        setTrend(
          trendRaw
            .map((row) => ({
              month_start: String(row.month_start ?? ''),
              revenue_usd: num(row.revenue_usd),
              spend_usd: num(row.spend_usd),
              total_runs: num(row.total_runs),
              successful_runs: num(row.successful_runs),
              new_opportunities: num(row.new_opportunities),
              won_opportunities: num(row.won_opportunities),
            }))
            .reverse(),
        );
      } finally {
        setIsTrendLoading(false);
      }
    }

    loadTrend();
  }, []);

  useEffect(() => {
    async function loadMonthScoped() {
      const monthKey = selectedMonth.slice(0, 10);
      if (!monthKey || !/^\d{4}-\d{2}-\d{2}$/.test(monthKey)) return;

      setIsMonthLoading(true);
      setMonthNotice(null);

      try {
        const [summaryRaw, orgRowsRaw] = await Promise.all([
          runWarehouseQuerySafe(`
            SELECT
              SUM(recognized_revenue_usd) AS recognized_revenue_usd,
              SUM(total_spend_usd) AS total_spend_usd,
              SUM(total_runs) AS total_runs,
              SUM(successful_runs) AS successful_runs,
              SUM(new_leads) AS new_leads,
              SUM(new_opportunities) AS new_opportunities,
              SUM(won_opportunities) AS won_opportunities,
              SUM(pipeline_open_usd) AS pipeline_open_usd,
              SUM(mrr_usd) AS mrr_usd,
              SUM(ap_open_usd) AS ap_open_usd
            FROM term.business_snapshot_monthly
            WHERE month_start = DATE '${monthKey}'
          `),
          runWarehouseQuerySafe(`
            SELECT
              organization_id,
              organization_name,
              current_plan_name,
              organization_status,
              recognized_revenue_usd,
              total_spend_usd,
              total_runs,
              successful_runs,
              success_rate_pct,
              new_opportunities,
              won_opportunities,
              pipeline_open_usd,
              mrr_usd,
              gross_margin_proxy_usd,
              mom_revenue_growth_pct,
              mom_runs_growth_pct,
              mom_spend_growth_pct
            FROM term.business_snapshot_monthly
            WHERE month_start = DATE '${monthKey}'
            ORDER BY recognized_revenue_usd DESC, total_runs DESC
            LIMIT 80
          `),
        ]);

        const scoped = (summaryRaw[0] as Partial<Record<string, unknown>>) || {};
        setSummary({
          revenue_usd: num(scoped.recognized_revenue_usd),
          spend_usd: num(scoped.total_spend_usd),
          total_runs: num(scoped.total_runs),
          successful_runs: num(scoped.successful_runs),
          new_leads: num(scoped.new_leads),
          new_opportunities: num(scoped.new_opportunities),
          won_opportunities: num(scoped.won_opportunities),
          pipeline_open_usd: num(scoped.pipeline_open_usd),
          mrr_usd: num(scoped.mrr_usd),
          ap_open_usd: num(scoped.ap_open_usd),
        });

        const normalized = (orgRowsRaw as Record<string, unknown>[]).map((row) => ({
          organization_id: String(row.organization_id ?? ''),
          organization_name: String(row.organization_name ?? ''),
          current_plan_name: String(row.current_plan_name ?? ''),
          organization_status: String(row.organization_status ?? ''),
          recognized_revenue_usd: num(row.recognized_revenue_usd),
          total_spend_usd: num(row.total_spend_usd),
          total_runs: num(row.total_runs),
          successful_runs: num(row.successful_runs),
          success_rate_pct: num(row.success_rate_pct),
          new_opportunities: num(row.new_opportunities),
          won_opportunities: num(row.won_opportunities),
          pipeline_open_usd: num(row.pipeline_open_usd),
          mrr_usd: num(row.mrr_usd),
          gross_margin_proxy_usd: num(row.gross_margin_proxy_usd),
          mom_revenue_growth_pct: num(row.mom_revenue_growth_pct),
          mom_runs_growth_pct: num(row.mom_runs_growth_pct),
          mom_spend_growth_pct: num(row.mom_spend_growth_pct),
        }));

        if (normalized.length === 0) {
          setMonthNotice(`No rows found for ${shortMonth(selectedMonth)}.`);
        }

        setOrgRows(normalized);
      } finally {
        setIsMonthLoading(false);
      }
    }

    loadMonthScoped();
  }, [selectedMonth]);

  useEffect(() => {
    const onGlobalKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isEditable) return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        searchInputRef.current?.focus();
        setShowTypeahead(true);
      }
    };

    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  const currentMonthTrend = useMemo(
    () => trend.find((row) => row.month_start.slice(0, 10) === selectedMonth.slice(0, 10)) || null,
    [selectedMonth, trend],
  );

  const selectedMonthIndex = useMemo(
    () => trend.findIndex((row) => row.month_start.slice(0, 10) === selectedMonth.slice(0, 10)),
    [selectedMonth, trend],
  );

  const priorMonthTrend = useMemo(() => {
    if (selectedMonthIndex <= 0) return null;
    return trend[selectedMonthIndex - 1] || null;
  }, [selectedMonthIndex, trend]);

  const globalSuccessRate = useMemo(() => {
    if (!summary) return 0;
    return asPct(summary.successful_runs, summary.total_runs);
  }, [summary]);

  const grossMarginPct = useMemo(() => {
    if (!summary) return 0;
    return asPct(summary.revenue_usd - summary.spend_usd, summary.revenue_usd);
  }, [summary]);

  const winRate = useMemo(() => {
    if (!summary) return 0;
    return asPct(summary.won_opportunities, summary.new_opportunities);
  }, [summary]);

  const activeOrganizations = useMemo(
    () => orgRows.filter((row) => row.total_runs > 0 || row.recognized_revenue_usd > 0).length,
    [orgRows],
  );

  const rangeMonths = useMemo(() => {
    const sizeByRange: Record<RangeKey, number> = {
      THIS_MONTH: 1,
      LAST_QUARTER: 3,
      LAST_6_MONTHS: 6,
      LAST_12_MONTHS: 12,
    };

    const count = sizeByRange[selectedRange];
    const baseIndex = selectedMonthIndex >= 0 ? selectedMonthIndex : trend.length - 1;
    if (baseIndex < 0) return trend;
    const startIndex = Math.max(baseIndex - count + 1, 0);
    return trend.slice(startIndex, baseIndex + 1);
  }, [selectedMonthIndex, selectedRange, trend]);

  const trendLabels = rangeMonths.map((row) => shortMonth(row.month_start));

  const financeSeries: ChartSeries[] = [
    { name: 'Revenue', color: '#0F766E', values: rangeMonths.map((row) => row.revenue_usd) },
    { name: 'Compute Spend', color: '#DC2626', values: rangeMonths.map((row) => row.spend_usd) },
  ];

  const conversionSeries: ChartSeries[] = [
    { name: 'Automation Runs', color: '#1D4ED8', values: rangeMonths.map((row) => row.total_runs) },
    { name: 'New Opportunities', color: '#D97706', values: rangeMonths.map((row) => row.new_opportunities) },
  ];

  const scoreboardRows = useMemo<ScoreboardRow[]>(() => {
    const grossMarginTrend = rangeMonths.map((row) => asPct(row.revenue_usd - row.spend_usd, row.revenue_usd));
    const successTrend = rangeMonths.map((row) => asPct(row.successful_runs, row.total_runs));
    const activeOrgTrend = rangeMonths.map((row) => {
      const monthKey = row.month_start.slice(0, 10);
      if (monthKey === selectedMonth.slice(0, 10)) return activeOrganizations;
      return 0;
    });
    const winRateTrend = rangeMonths.map((row) => asPct(row.won_opportunities, row.new_opportunities));

    return [
      { label: 'Revenue', group: 'Financial', values: rangeMonths.map((row) => row.revenue_usd), formatter: usd },
      { label: 'Spend', group: 'Financial', values: rangeMonths.map((row) => row.spend_usd), formatter: usd, positiveGood: false },
      { label: 'Gross Margin', group: 'Financial', values: grossMarginTrend, formatter: pct },
      { label: 'Automation Runs', group: 'Product', values: rangeMonths.map((row) => row.total_runs), formatter: (value) => value.toLocaleString() },
      { label: 'Run Success %', group: 'Product', values: successTrend, formatter: pct },
      { label: 'Active Orgs', group: 'Product', values: activeOrgTrend, formatter: (value) => value.toLocaleString() },
      { label: 'New Opportunities', group: 'GTM', values: rangeMonths.map((row) => row.new_opportunities), formatter: (value) => value.toLocaleString() },
      { label: 'Won Opportunities', group: 'GTM', values: rangeMonths.map((row) => row.won_opportunities), formatter: (value) => value.toLocaleString() },
      { label: 'Win Rate', group: 'GTM', values: winRateTrend, formatter: pct },
    ];
  }, [activeOrganizations, rangeMonths, selectedMonth]);

  const customerSignals = useMemo<CustomerSignalRow[]>(
    () => [...orgRows].map(signalScore).sort((left, right) => right.score - left.score).slice(0, 12),
    [orgRows],
  );

  const healthSummary = useMemo<HealthSummary>(() => {
    const spendDelta = summary && priorMonthTrend ? changePct(summary.spend_usd, priorMonthTrend.spend_usd) : 0;
    const revenueDelta = summary && priorMonthTrend ? changePct(summary.revenue_usd, priorMonthTrend.revenue_usd) : 0;

    if (grossMarginPct < 0) {
      return { status: 'At Risk', reason: 'Negative margin driven by infrastructure spend.' };
    }
    if (revenueDelta < spendDelta || globalSuccessRate < 75) {
      return { status: 'Watch', reason: 'Revenue quality is improving slower than operating cost.' };
    }
    return { status: 'Stable', reason: 'Revenue and usage are moving in the right direction.' };
  }, [globalSuccessRate, grossMarginPct, priorMonthTrend, summary]);

  const executiveSummary = useMemo(() => {
    if (!summary) return [];

    const revenueSentence =
      grossMarginPct < 0
        ? `Revenue is ${priorMonthTrend ? deltaLabel(summary.revenue_usd, priorMonthTrend.revenue_usd).text.toLowerCase() : 'holding steady'}, but margin remains negative because spend is outpacing revenue.`
        : `Revenue is ${priorMonthTrend ? deltaLabel(summary.revenue_usd, priorMonthTrend.revenue_usd).text.toLowerCase() : 'holding steady'} with ${pct(grossMarginPct)} gross margin.`;

    const productSentence = `Automation runs reached ${summary.total_runs.toLocaleString()} with a ${pct(globalSuccessRate)} success rate.`;
    const gtmSentence = `GTM generated ${summary.new_opportunities.toLocaleString()} new opportunities and ${summary.won_opportunities.toLocaleString()} wins for a ${pct(winRate)} win rate.`;
    const customerSentence =
      customerSignals.length > 0
        ? `${customerSignals.filter((row) => row.signal === 'Expansion candidate' || row.signal === 'Conversion candidate').length} customers are showing expansion or conversion signals.`
        : 'No meaningful customer signals were detected in the current month.';

    return [revenueSentence, productSentence, gtmSentence, customerSentence];
  }, [customerSignals, globalSuccessRate, grossMarginPct, priorMonthTrend, summary, winRate]);

  const metricCards = useMemo<MetricCardConfig[]>(() => {
    if (!summary) return [];

    const revenueDelta = deltaLabel(summary.revenue_usd, priorMonthTrend?.revenue_usd || 0);
    const spendDelta = deltaLabel(summary.spend_usd, priorMonthTrend?.spend_usd || 0, true);
    const runsDelta = deltaLabel(summary.total_runs, priorMonthTrend?.total_runs || 0);
    const successDelta = deltaLabel(globalSuccessRate, asPct(priorMonthTrend?.successful_runs || 0, priorMonthTrend?.total_runs || 0));
    const marginDelta = grossMarginPct >= 0
      ? { text: `${pct(grossMarginPct)} gross margin`, tone: 'positive' as const }
      : { text: `${pct(Math.abs(grossMarginPct))} below break-even`, tone: 'negative' as const };

    return [
      { label: 'Monthly Revenue', value: usd(summary.revenue_usd), delta: revenueDelta.text, tone: revenueDelta.tone, href: '/terminal/finance' },
      { label: 'Compute Spend', value: usd(summary.spend_usd), delta: spendDelta.text, tone: spendDelta.tone, href: '/terminal/finance' },
      { label: 'Gross Margin', value: pct(grossMarginPct), delta: marginDelta.text, tone: marginDelta.tone, href: '/terminal/finance' },
      { label: 'Active Organizations', value: activeOrganizations.toLocaleString(), delta: 'Organizations with revenue or usage this month', tone: 'neutral', href: '/customers' },
      { label: 'Automation Runs', value: summary.total_runs.toLocaleString(), delta: runsDelta.text, tone: runsDelta.tone, href: '/terminal/unit-economics' },
      { label: 'Run Success Rate', value: pct(globalSuccessRate), delta: successDelta.text, tone: successDelta.tone, href: '/terminal/product' },
    ];
  }, [activeOrganizations, globalSuccessRate, grossMarginPct, priorMonthTrend, summary]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const monthItems = monthOptions.slice(0, 8).map((month) => ({
      key: `month-${month}`,
      label: `OV ${shortMonth(month)}`,
      hint: 'Overview snapshot',
      action: () => setSelectedMonth(month),
    }));

    const functionItems = VISIBLE_TERMINAL_FUNCTIONS.map((fn) => ({
      key: `fn-${fn.code.toLowerCase()}`,
      label: fn.usage,
      hint: `Function · ${fn.title}`,
      action: () => router.push(fn.route),
    }));

    const exampleItems = [
      { key: 'example-ov', label: 'OV', hint: 'Company overview', action: () => router.push('/terminal') },
      { key: 'example-this', label: 'OV THIS MONTH', hint: 'Monthly snapshot', action: () => router.push('/terminal') },
      { key: 'example-fin', label: 'OV FIN', hint: 'Financial health', action: () => router.push('/terminal/finance') },
      { key: 'example-gtm', label: 'OV GTM', hint: 'Pipeline health', action: () => router.push('/terminal/growth') },
    ];

    return [...exampleItems, ...functionItems, ...monthItems];
  }, [monthOptions, router]);

  const filteredSuggestions = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return suggestions.slice(0, 8);
    return suggestions.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(query)).slice(0, 12);
  }, [deferredSearch, suggestions]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [deferredSearch]);

  const activeFunction = useMemo(() => {
    const token = search.trim().split(/\s+/)[0] || '';
    return findTerminalFunction(token);
  }, [search]);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!filteredSuggestions.length) return;
      setShowTypeahead(true);
      setActiveSuggestionIndex((previous) => Math.min(previous + 1, filteredSuggestions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!filteredSuggestions.length) return;
      setShowTypeahead(true);
      setActiveSuggestionIndex((previous) => Math.max(previous - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      const handled = runFunctionCommand(search);
      if (handled) {
        event.preventDefault();
        setShowTypeahead(false);
        return;
      }

      if (isCustomerCommand(search) && filteredSuggestions.length > 0) {
        event.preventDefault();
        const picked = filteredSuggestions[activeSuggestionIndex] || filteredSuggestions[0];
        setSearch(picked.label);
        setShowTypeahead(false);
        picked.action();
        return;
      }

      if (!filteredSuggestions.length) return;
      event.preventDefault();
      const picked = filteredSuggestions[activeSuggestionIndex] || filteredSuggestions[0];
      setSearch(picked.label);
      setShowTypeahead(false);
      picked.action();
      return;
    }

    if (event.key === 'Tab' && activeFunction) {
      event.preventDefault();
      setSearch(activeFunction.usage);
    }
  };

  if (isLoading || (isMonthLoading && !summary)) {
    return (
      <TerminalShell
        active="overview"
        title="Intelligence Terminal"
        subtitle="Operator console for business health, usage, GTM, and customer signals."
      >
        <LoadingState title="Loading overview" description="Querying term.business_snapshot_monthly and building the operator console." />
      </TerminalShell>
    );
  }

  if (error || !summary) {
    return (
      <TerminalShell
        active="overview"
        title="Intelligence Terminal"
        subtitle="Operator console for business health, usage, GTM, and customer signals."
      >
        <EmptyState
          title="Overview unavailable"
          description={error || 'No summary rows found.'}
          actionLabel="Retry"
          onAction={() => window.location.reload()}
        />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell
      active="overview"
      title="Intelligence Terminal"
      subtitle="Operator console for business health, usage, GTM, and customer signals."
      search={(
        <div className="relative">
          <SearchInput
            ref={searchInputRef}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setShowTypeahead(true);
            }}
            onFocus={() => setShowTypeahead(true)}
            onBlur={() => setTimeout(() => setShowTypeahead(false), 120)}
            onKeyDown={onSearchKeyDown}
            placeholder="Try: OV, OV THIS MONTH, OV FIN, OV GTM  (/ to focus)"
          />
          {activeFunction ? (
            <div className="mt-1 rounded border border-border bg-surface-primary px-2 py-1 text-[11px] text-content-secondary">
              <span className="font-semibold text-content-primary">{activeFunction.code}</span>
              {` · ${activeFunction.summary} · ${activeFunction.objective}`}
            </div>
          ) : null}
          {showTypeahead ? (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface-elevated shadow-medium">
              {filteredSuggestions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-content-tertiary">No matches</div>
              ) : (
                filteredSuggestions.map((item, index) => (
                  <button
                    key={item.key}
                    className={`w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-tertiary ${
                      index === activeSuggestionIndex ? 'bg-surface-tertiary' : ''
                    }`}
                    onMouseDown={() => {
                      setSearch(item.label);
                      setShowTypeahead(false);
                      item.action();
                    }}
                  >
                    <p className="text-xs font-medium text-content-primary">{item.label}</p>
                    <p className="text-[11px] text-content-tertiary">{item.hint}</p>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      )}
      headerMeta={(
        <div className="flex items-center gap-2">
          <Badge variant={healthSummary.status === 'Stable' ? 'success' : healthSummary.status === 'Watch' ? 'warning' : 'error'}>
            {healthSummary.status}
          </Badge>
          <Badge variant="neutral">{shortMonth(selectedMonth)}</Badge>
        </div>
      )}
    >
      <section className="mb-4 rounded-2xl border border-border bg-surface-elevated p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={healthSummary.status === 'Stable' ? 'success' : healthSummary.status === 'Watch' ? 'warning' : 'error'}>
                Business Health: {healthSummary.status}
              </Badge>
              <Badge variant="accent">OV</Badge>
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Executive Summary</p>
            <h2 className="mt-2 text-xl font-semibold text-content-primary">How is the business doing right now?</h2>
            <p className="mt-2 text-sm text-content-secondary">{healthSummary.reason}</p>
            <div className="mt-4 grid gap-2">
              {executiveSummary.map((line) => (
                <p key={line} className="text-sm text-content-primary">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="min-w-[280px] rounded-2xl border border-border bg-surface-primary p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Command Examples</p>
            <div className="mt-3 grid gap-2 text-sm">
              <button type="button" onClick={() => router.push('/terminal')} className="text-left text-content-primary hover:text-accent">
                <span className="font-semibold">OV</span> <span className="text-content-secondary">→ company overview</span>
              </button>
              <button type="button" onClick={() => router.push('/terminal')} className="text-left text-content-primary hover:text-accent">
                <span className="font-semibold">OV THIS MONTH</span> <span className="text-content-secondary">→ monthly snapshot</span>
              </button>
              <button type="button" onClick={() => router.push('/terminal/finance')} className="text-left text-content-primary hover:text-accent">
                <span className="font-semibold">OV FIN</span> <span className="text-content-secondary">→ financial health</span>
              </button>
              <button type="button" onClick={() => router.push('/terminal/growth')} className="text-left text-content-primary hover:text-accent">
                <span className="font-semibold">OV GTM</span> <span className="text-content-secondary">→ pipeline health</span>
              </button>
            </div>
            <div className="mt-4 border-t border-border pt-3 text-xs text-content-tertiary">
              Cmd/Ctrl+K opens search. Cmd/Ctrl+1 Overview. Cmd/Ctrl+2 GTM. Cmd/Ctrl+3 Leads.
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Key Metrics</p>
            <p className="text-sm text-content-secondary">Interpreted KPIs for the selected month.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RangeToggle active={selectedRange} onChange={setSelectedRange} />
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-full border border-border bg-surface-primary px-3 py-1.5 text-xs text-content-primary"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {shortMonth(month)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {monthNotice ? <p className="mb-3 text-xs text-content-tertiary">{monthNotice}</p> : null}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {metricCards.map((card) => (
            <MetricCard
              key={card.label}
              {...card}
              onClick={card.href ? () => router.push(card.href!) : undefined}
            />
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-border bg-surface-elevated p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Operating Scoreboard</p>
            <p className="text-sm text-content-secondary">Grouped company scoreboard across financial, product, and GTM signals.</p>
          </div>
          {isTrendLoading ? <Badge variant="warning">Refreshing</Badge> : <Badge variant="neutral">{rangeMonths.length} Months</Badge>}
        </div>

        <div className="overflow-auto rounded-xl border border-border">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-content-tertiary">Metric</th>
                {trendLabels.map((label) => (
                  <th key={label} className="border-b border-border px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['Financial', 'Product', 'GTM'] as const).map((group) => (
                <Fragment key={group}>
                  <tr key={`${group}-header`} className="bg-surface-primary">
                    <td colSpan={trendLabels.length + 1} className="border-t border-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-content-tertiary">
                      {group}
                    </td>
                  </tr>
                  {scoreboardRows
                    .filter((row) => row.group === group)
                    .map((row) => (
                      <tr key={row.label} className="odd:bg-surface-primary even:bg-surface-secondary/30">
                        <td className="border-t border-border px-3 py-2 text-content-primary">{row.label}</td>
                        {row.values.map((value, index) => {
                          const isPositive = value >= 0;
                          const tone = row.positiveGood === false
                            ? (isPositive ? 'text-content-primary' : 'text-green-600')
                            : (isPositive ? 'text-green-600' : 'text-red-500');
                          return (
                            <td key={`${row.label}-${index}`} className={`border-t border-border px-3 py-2 text-right font-medium ${tone}`}>
                              {row.formatter(value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-4">
        <div className="mb-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Trend Charts</p>
          <p className="text-sm text-content-secondary">Each chart answers a specific operating question.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-content-primary">Revenue vs Compute Spend</p>
                <p className="text-xs text-content-tertiary">Is profitability improving or getting worse?</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => router.push('/terminal/finance')}>
                Open FIN
              </Button>
            </div>
            <MiniSeriesChart labels={trendLabels} series={financeSeries} />
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-content-primary">Runs to Opportunity Creation</p>
                <p className="text-xs text-content-tertiary">Is product usage translating into GTM momentum?</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => router.push('/terminal/growth')}>
                Open GTM
              </Button>
            </div>
            <MiniSeriesChart labels={trendLabels} series={conversionSeries} />
          </div>

          <div className="rounded-2xl border border-border bg-surface-elevated p-4 xl:col-span-2">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-content-primary">Adoption Context</p>
                <p className="text-xs text-content-tertiary">How much of the portfolio is active in the selected month?</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => router.push('/customers')}>
                Open Customers
              </Button>
            </div>
            {currentMonthTrend ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface-primary p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Active Organizations</p>
                  <p className="mt-2 text-2xl font-semibold text-content-primary">{activeOrganizations.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-content-tertiary">Organizations with revenue or automation activity this month.</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-primary p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Runs per Active Org</p>
                  <p className="mt-2 text-2xl font-semibold text-content-primary">
                    {activeOrganizations > 0 ? Math.round(summary.total_runs / activeOrganizations).toLocaleString() : '0'}
                  </p>
                  <p className="mt-1 text-xs text-content-tertiary">Usage concentration across the active base.</p>
                </div>
                <div className="rounded-xl border border-border bg-surface-primary p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Opportunities per 1K Runs</p>
                  <p className="mt-2 text-2xl font-semibold text-content-primary">
                    {summary.total_runs > 0 ? Math.round((summary.new_opportunities / summary.total_runs) * 1000).toLocaleString() : '0'}
                  </p>
                  <p className="mt-1 text-xs text-content-tertiary">Commercial conversion signal from product usage.</p>
                </div>
              </div>
            ) : <div className="rounded-xl border border-border bg-surface-primary p-4 text-sm text-content-tertiary">No adoption context available for the selected month.</div>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-elevated p-4">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-content-tertiary">Customer Signals</p>
            <p className="text-sm text-content-secondary">Actionable customer flags instead of a raw leaderboard.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Expansion</Badge>
            <Badge variant="warning">Conversion</Badge>
            <Badge variant="error">At Risk</Badge>
            <Badge variant="neutral">Inactive</Badge>
          </div>
        </div>

        {isMonthLoading ? <p className="mb-3 text-xs text-content-tertiary">Refreshing customer signals...</p> : null}

        <DataTable<CustomerSignalRow>
          columns={[
            {
              key: 'organization_name',
              header: 'Organization',
              render: (row) => (
                <button
                  type="button"
                  className="text-left font-medium text-content-primary hover:text-accent"
                  onClick={() => router.push(`/customers/${encodeURIComponent(row.organization_id)}`)}
                >
                  {row.organization_name}
                </button>
              ),
            },
            { key: 'current_plan_name', header: 'Plan' },
            { key: 'revenue', header: 'Revenue', align: 'right', render: (row) => usd(row.revenue) },
            { key: 'runs', header: 'Runs', align: 'right', render: (row) => row.runs.toLocaleString() },
            {
              key: 'signal',
              header: 'Signal',
              render: (row) => <Badge variant={signalVariant(row.signal)}>{row.signal}</Badge>,
            },
            { key: 'detail', header: 'Why' },
            {
              key: 'actions',
              header: 'Drill',
              render: (row) => (
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => router.push(`/customers/${encodeURIComponent(row.organization_id)}`)}>
                    Account
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => router.push(`/terminal/unit-economics?customer=${encodeURIComponent(row.organization_id)}`)}>
                    UE
                  </Button>
                </div>
              ),
            },
          ]}
          rows={customerSignals}
          emptyLabel="No customer signals found for the selected month"
        />
      </section>
    </TerminalShell>
  );
}
