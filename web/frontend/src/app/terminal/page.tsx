'use client';

import { Fragment, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  LoadingState,
  SearchInput,
} from '@/components/ui';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';
import TerminalShell from '@/components/terminal/TerminalShell';
import { findTerminalFunction, resolveTerminalCommandHref, TERMINAL_FUNCTIONS, VISIBLE_TERMINAL_FUNCTIONS } from '@/lib/terminalFunctions';

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

interface OrgHistoryRow {
  month_start: string;
  recognized_revenue_usd: number;
  total_spend_usd: number;
  total_runs: number;
  successful_runs: number;
  new_opportunities: number;
  won_opportunities: number;
  pipeline_open_usd: number;
  mrr_usd: number;
  mom_revenue_growth_pct: number;
  mom_runs_growth_pct: number;
  mom_spend_growth_pct: number;
  feature_adoption_rate: number;
}

interface Suggestion {
  key: string;
  label: string;
  hint: string;
  action: () => void;
}

function isCustomerCommand(query: string): boolean {
  return /^(?:cus|cust|cuss|customer)(?:[\s.]|$)/i.test(query.trim());
}

function extractCustomerQuery(query: string): string {
  return query.trim().replace(/^(?:cus|cust|cuss|customer)(?:[\s.:-]+)?/i, '').trim().toLowerCase();
}

interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

type FunctionDesk = 'ALL' | 'GTM' | 'FINANCE' | 'PRODUCT';

interface MatrixRow {
  label: string;
  category: 'Key Financials' | 'Operating';
  values: number[];
  formatter: (value: number) => string;
  positiveGood?: boolean;
}

interface MonthScopedCombinedRow {
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
  ap_open_usd: number;
  new_leads: number;
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

function MiniSeriesChart({ labels, series }: { labels: string[]; series: ChartSeries[] }) {
  if (!labels.length || !series.length) {
    return <div className="h-44 rounded-md border border-border bg-surface-primary" />;
  }

  const width = 760;
  const height = 210;
  const padL = 44;
  const padR = 12;
  const padT = 14;
  const padB = 26;

  const allValues = series.flatMap((s) => s.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  const toX = (i: number) => padL + (i / Math.max(labels.length - 1, 1)) * (width - padL - padR);
  const toY = (v: number) => height - padB - ((v - min) / range) * (height - padT - padB);

  return (
    <div className="rounded-md border border-border bg-surface-primary p-2">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-content-secondary">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        {Array.from({ length: 5 }).map((_, idx) => {
          const y = padT + (idx / 4) * (height - padT - padB);
          const tick = max - (idx / 4) * range;
          return (
            <g key={idx}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--border-primary)" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-tertiary)">
                {formatCompact(tick)}
              </text>
            </g>
          );
        })}

        {series.map((s) => (
          <polyline
            key={s.name}
            points={s.values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth="2.4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-1 grid grid-cols-3 text-xs text-content-tertiary">
        <span>{labels[0]}</span>
        <span className="text-center">{labels[Math.floor(labels.length / 2)]}</span>
        <span className="text-right">{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-surface-primary px-2 py-1.5">
      <p className="text-[11px] text-content-tertiary">{label}</p>
      <p className="text-sm font-semibold text-content-primary">{value}</p>
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

  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [orgRows, setOrgRows] = useState<OrgSnapshotRow[]>([]);

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [orgHistory, setOrgHistory] = useState<OrgHistoryRow[]>([]);

  const [search, setSearch] = useState('');
  const [showTypeahead, setShowTypeahead] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [activeDesk, setActiveDesk] = useState<FunctionDesk>('ALL');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOrg = useMemo(() => orgRows.find((row) => row.organization_id === selectedOrgId) || null, [orgRows, selectedOrgId]);

  const runFunctionCommand = (raw: string): boolean => {
    const input = raw.trim();
    if (!input) return false;
    const [token, ...rest] = input.split(/\s+/);
    const code = token.toUpperCase();
    const arg = rest.join(' ').trim();
    const normalizedArg = arg.toLowerCase();
    const href = resolveTerminalCommandHref(input);
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
          setIsLoading(false);
          return;
        }

        setMonthOptions(months);
        const monthParam = new URLSearchParams(window.location.search).get('month') || '';
        const monthPrefix = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : monthParam.slice(0, 7);
        const matchedMonth = monthPrefix ? months.find((month) => month.startsWith(monthPrefix)) : undefined;
        setSelectedMonth(matchedMonth || months[0]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load overview data.');
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
      setSelectedOrgId('');
      setOrgHistory([]);
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
            LIMIT 60
          `),
        ]);

        const s: Partial<MonthScopedCombinedRow> = (summaryRaw[0] as Partial<MonthScopedCombinedRow>) || {};
        setSummary({
          revenue_usd: num(s.recognized_revenue_usd),
          spend_usd: num(s.total_spend_usd),
          total_runs: num(s.total_runs),
          successful_runs: num(s.successful_runs),
          new_leads: num(s.new_leads),
          new_opportunities: num(s.new_opportunities),
          won_opportunities: num(s.won_opportunities),
          pipeline_open_usd: num(s.pipeline_open_usd),
          mrr_usd: num(s.mrr_usd),
          ap_open_usd: num(s.ap_open_usd),
        });

        const normalized = (orgRowsRaw as unknown as MonthScopedCombinedRow[]).map((row) => ({
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
    async function loadOrganizationHistory() {
      if (!selectedOrgId) {
        setOrgHistory([]);
        return;
      }

      const safeOrg = selectedOrgId.replace(/'/g, "''");
      const historyRaw = await runWarehouseQuerySafe(`
        SELECT
          month_start,
          recognized_revenue_usd,
          total_spend_usd,
          total_runs,
          successful_runs,
          new_opportunities,
          won_opportunities,
          pipeline_open_usd,
          mrr_usd,
          mom_revenue_growth_pct,
          mom_runs_growth_pct,
          mom_spend_growth_pct,
          feature_adoption_rate
        FROM term.business_snapshot_monthly
        WHERE organization_id = '${safeOrg}'
        ORDER BY month_start DESC
        LIMIT 18
      `);

      setOrgHistory(
        historyRaw
          .map((row) => ({
            month_start: String(row.month_start ?? ''),
            recognized_revenue_usd: num(row.recognized_revenue_usd),
            total_spend_usd: num(row.total_spend_usd),
            total_runs: num(row.total_runs),
            successful_runs: num(row.successful_runs),
            new_opportunities: num(row.new_opportunities),
            won_opportunities: num(row.won_opportunities),
            pipeline_open_usd: num(row.pipeline_open_usd),
            mrr_usd: num(row.mrr_usd),
            mom_revenue_growth_pct: num(row.mom_revenue_growth_pct),
            mom_runs_growth_pct: num(row.mom_runs_growth_pct),
            mom_spend_growth_pct: num(row.mom_spend_growth_pct),
            feature_adoption_rate: num(row.feature_adoption_rate),
          }))
          .reverse(),
      );
    }

    loadOrganizationHistory();
  }, [selectedOrgId]);

  const globalWinRate = useMemo(() => {
    if (!summary) return 0;
    return asPct(summary.won_opportunities, summary.new_opportunities);
  }, [summary]);

  const globalSuccessRate = useMemo(() => {
    if (!summary) return 0;
    return asPct(summary.successful_runs, summary.total_runs);
  }, [summary]);

  const trendLabels = trend.map((row) => shortMonth(row.month_start));

  const financeSeries: ChartSeries[] = [
    { name: 'Revenue', color: '#0F766E', values: trend.map((row) => row.revenue_usd) },
    { name: 'Spend', color: '#DC2626', values: trend.map((row) => row.spend_usd) },
  ];

  const opsSeries: ChartSeries[] = [
    { name: 'Total Runs', color: '#1D4ED8', values: trend.map((row) => row.total_runs) },
    { name: 'Won Opps', color: '#7C3AED', values: trend.map((row) => row.won_opportunities) },
  ];

  const orgLabels = orgHistory.map((row) => shortMonth(row.month_start));
  const orgSeries: ChartSeries[] = [
    { name: 'Revenue', color: '#0F766E', values: orgHistory.map((row) => row.recognized_revenue_usd) },
    { name: 'Spend', color: '#DC2626', values: orgHistory.map((row) => row.total_spend_usd) },
    { name: 'Runs', color: '#1D4ED8', values: orgHistory.map((row) => row.total_runs) },
  ];

  const recentTrend = trend.slice(-8);
  const matrixMonths = recentTrend.map((row) => shortMonth(row.month_start));
  const matrixRows = useMemo<MatrixRow[]>(() => {
    const grossMargin = recentTrend.map((row) => asPct(row.revenue_usd - row.spend_usd, row.revenue_usd));
    const runSuccess = recentTrend.map((row) => asPct(row.successful_runs, row.total_runs));
    const winRate = recentTrend.map((row) => asPct(row.won_opportunities, row.new_opportunities));

    return [
      { label: 'Total Revenue', category: 'Key Financials', values: recentTrend.map((row) => row.revenue_usd), formatter: usd },
      { label: 'Total Spend', category: 'Key Financials', values: recentTrend.map((row) => row.spend_usd), formatter: usd, positiveGood: false },
      { label: 'Gross Margin %', category: 'Key Financials', values: grossMargin, formatter: pct },
      { label: 'Total Runs', category: 'Operating', values: recentTrend.map((row) => row.total_runs), formatter: (v) => v.toLocaleString() },
      { label: 'Run Success %', category: 'Operating', values: runSuccess, formatter: pct },
      { label: 'New Opportunities', category: 'Operating', values: recentTrend.map((row) => row.new_opportunities), formatter: (v) => v.toLocaleString() },
      { label: 'Won Opportunities', category: 'Operating', values: recentTrend.map((row) => row.won_opportunities), formatter: (v) => v.toLocaleString() },
      { label: 'Win Rate %', category: 'Operating', values: winRate, formatter: pct },
    ];
  }, [recentTrend]);

  const deskSummary = useMemo(() => {
    if (!summary) return null;
    const byDesk = {
      ALL: [
        { label: 'Revenue', value: usd(summary.revenue_usd) },
        { label: 'Spend', value: usd(summary.spend_usd) },
        { label: 'Runs', value: summary.total_runs.toLocaleString() },
      ],
      GTM: [
        { label: 'New Leads', value: summary.new_leads.toLocaleString() },
        { label: 'New Opps', value: summary.new_opportunities.toLocaleString() },
        { label: 'Win Rate', value: pct(globalWinRate) },
      ],
      FINANCE: [
        { label: 'Revenue', value: usd(summary.revenue_usd) },
        { label: 'MRR', value: usd(summary.mrr_usd) },
        { label: 'Gross Margin', value: usd(summary.revenue_usd - summary.spend_usd) },
      ],
      PRODUCT: [
        { label: 'Selected Org', value: selectedOrg?.organization_name || 'None' },
        { label: 'Org Runs', value: selectedOrg ? selectedOrg.total_runs.toLocaleString() : '0' },
        { label: 'Org Success', value: selectedOrg ? pct(selectedOrg.success_rate_pct) : 'n/a' },
      ],
    } as const;

    return byDesk[activeDesk];
  }, [activeDesk, globalWinRate, selectedOrg, summary]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const monthItems = monthOptions.slice(0, 8).map((month) => ({
      key: `month-${month}`,
      label: shortMonth(month),
      hint: 'Switch month',
      action: () => setSelectedMonth(month),
    }));

    const functionItems = VISIBLE_TERMINAL_FUNCTIONS.map((fn) => ({
      key: `fn-${fn.code.toLowerCase()}`,
      label: fn.usage,
      hint: `Function · ${fn.title} · ${fn.primaryModel}`,
      action: () => router.push(fn.route),
    }));
    const functionShortcutItems = [
      { key: 'fn-short-ov-lm', label: 'OV.LM', hint: 'Function shortcut · Overview last month', action: () => router.push('/terminal') },
      { key: 'fn-short-ov-this', label: 'OV.THIS', hint: 'Function shortcut · Overview current month', action: () => router.push('/terminal') },
      { key: 'fn-short-ov-m2', label: 'OV.M-2', hint: 'Function shortcut · Overview two months ago', action: () => router.push('/terminal') },
      { key: 'fn-short-meta-schema', label: 'META.SCHEMA', hint: 'Function shortcut · Metadata schema panel', action: () => router.push('/terminal/meta?panel=schema') },
      { key: 'fn-short-meta-dict', label: 'META.DICT', hint: 'Function shortcut · Metadata dictionary panel', action: () => router.push('/terminal/meta?panel=dictionary') },
    ];

    const navItems = [
      { key: 'nav-growth', label: 'GTM Terminal', hint: 'View', action: () => router.push('/terminal/growth') },
      { key: 'nav-finance', label: 'Finance Terminal', hint: 'View', action: () => router.push('/terminal/finance') },
      { key: 'nav-product', label: 'Product Terminal', hint: 'View', action: () => router.push('/terminal/product') },
    ];

    return [...functionShortcutItems, ...functionItems, ...monthItems, ...navItems];
  }, [monthOptions, router]);

  const filteredSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 10);
    return suggestions.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(q)).slice(0, 14);
  }, [search, suggestions]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [search]);

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

  const activeFunction = useMemo(() => {
    const token = search.trim().split(/\s+/)[0] || '';
    return findTerminalFunction(token);
  }, [search]);

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!filteredSuggestions.length) return;
      setShowTypeahead(true);
      setActiveSuggestionIndex((prev) => Math.min(prev + 1, filteredSuggestions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!filteredSuggestions.length) return;
      setShowTypeahead(true);
      setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
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

  if (isLoading) {
    return (
      <TerminalShell
        active="overview"
        title="Intelligence Terminal"
        subtitle="Monthly business snapshot command center with organization drilldowns."
      >
        <LoadingState title="Loading monthly business intelligence" description="Querying term.business_snapshot_monthly and preparing domain views." />
      </TerminalShell>
    );
  }

  if (error || !summary) {
    return (
      <TerminalShell
        active="overview"
        title="Intelligence Terminal"
        subtitle="Monthly business snapshot command center with organization drilldowns."
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
      subtitle="Monthly business snapshot command center with organization drilldowns."
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
            placeholder="Type function: OV, OV.LM, OV.THIS, EXE, GTM, FIN, UE, META"
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
          <Badge variant="accent">MONTHLY SNAPSHOT</Badge>
          <Badge variant="neutral">{shortMonth(selectedMonth)}</Badge>
        </div>
      )}
    >
      <section className="mb-3 rounded-md border border-border bg-surface-elevated p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-content-tertiary">Command Cheatsheet</p>
            <p className="text-sm text-content-primary">Type a code and press Enter. Use Tab to autocomplete.</p>
          </div>
          <Badge variant="accent">/ or Cmd/Ctrl+K</Badge>
        </div>
        {monthNotice ? <p className="mb-2 text-xs text-content-tertiary">{monthNotice}</p> : null}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          {VISIBLE_TERMINAL_FUNCTIONS.map((fn) => (
            <div key={fn.code} className="rounded border border-border bg-surface-primary px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-content-primary">{fn.code}</p>
                <p className="text-[11px] text-content-tertiary truncate">{fn.usage}</p>
              </div>
              <p className="mt-0.5 text-[11px] text-content-tertiary truncate">{fn.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-3 rounded-md border border-border bg-surface-elevated p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {(['ALL', 'GTM', 'FINANCE', 'PRODUCT'] as FunctionDesk[]).map((desk) => (
            <button
              key={desk}
              className={`rounded border px-2 py-1 text-xs ${activeDesk === desk ? 'border-teal-600 bg-teal-700/15 text-teal-300' : 'border-border text-content-secondary'}`}
              onClick={() => setActiveDesk(desk)}
            >
              {desk === 'ALL' ? 'Overview' : desk}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {deskSummary?.map((item) => (
            <div key={item.label} className="rounded border border-border bg-surface-primary px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-content-tertiary">{item.label}</p>
              <p className="text-sm font-semibold text-content-primary">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-3 rounded-md border border-border bg-surface-elevated p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-content-tertiary">Financial Snapshot Matrix</p>
            <p className="text-sm text-content-primary">Monthly cross-functional view aligned to a terminal-style grid</p>
          </div>
          {isTrendLoading ? <Badge variant="warning">Refreshing</Badge> : <Badge variant="neutral">Last 8 Months</Badge>}
        </div>
        <div className="overflow-auto rounded border border-border">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="border-b border-border px-3 py-2 text-left uppercase tracking-wide text-content-tertiary">Metric</th>
                {matrixMonths.map((month) => (
                  <th key={month} className="border-b border-border px-3 py-2 text-right uppercase tracking-wide text-content-tertiary">{month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['Key Financials', 'Operating'] as const).map((category) => (
                <Fragment key={category}>
                  <tr key={`${category}-header`} className="bg-surface-primary">
                    <td colSpan={matrixMonths.length + 1} className="border-t border-border px-3 py-2 font-semibold uppercase tracking-wide text-content-tertiary">{category}</td>
                  </tr>
                  {matrixRows
                    .filter((row) => row.category === category)
                    .map((row) => (
                      <tr key={row.label} className="odd:bg-surface-primary even:bg-surface-secondary/30">
                        <td className="border-t border-border px-3 py-2 text-content-primary">{row.label}</td>
                        {row.values.map((value, idx) => {
                          const isPositive = value >= 0;
                          const tone = row.positiveGood === false ? (isPositive ? 'text-content-primary' : 'text-green-600') : (isPositive ? 'text-green-600' : 'text-red-500');
                          return (
                            <td key={`${row.label}-${idx}`} className={`border-t border-border px-3 py-2 text-right ${tone}`}>
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

      <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <section className="rounded-md border border-border bg-surface-elevated p-3">
          <p className="text-xs uppercase tracking-wide text-content-tertiary">Revenue vs Spend</p>
          <p className="mb-2 text-sm text-content-primary">Portfolio totals by month</p>
          <MiniSeriesChart labels={trendLabels} series={financeSeries} />
        </section>

        <section className="rounded-md border border-border bg-surface-elevated p-3">
          <p className="text-xs uppercase tracking-wide text-content-tertiary">Runs vs Wins</p>
          <p className="mb-2 text-sm text-content-primary">Operating output and growth conversion trend</p>
          <MiniSeriesChart labels={trendLabels} series={opsSeries} />
        </section>
      </div>

      <section className="mb-3 rounded-md border border-border bg-surface-elevated p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-content-tertiary">Organization Leaderboard</p>
            <p className="text-sm text-content-primary">Month slice: {shortMonth(selectedMonth)} · click Drill to inspect an org history</p>
          </div>
          <Badge variant="warning">Org Drill Enabled</Badge>
        </div>
        {isMonthLoading ? <p className="mb-2 text-xs text-content-tertiary">Refreshing month slice...</p> : null}
        <DataTable<OrgSnapshotRow>
          columns={[
            { key: 'organization_name', header: 'Organization' },
            { key: 'current_plan_name', header: 'Plan' },
            { key: 'recognized_revenue_usd', header: 'Revenue', align: 'right', render: (row) => usd(row.recognized_revenue_usd) },
            { key: 'total_spend_usd', header: 'Spend', align: 'right', render: (row) => usd(row.total_spend_usd) },
            { key: 'total_runs', header: 'Runs', align: 'right', render: (row) => row.total_runs.toLocaleString() },
            { key: 'success_rate_pct', header: 'Success', align: 'right', render: (row) => pct(row.success_rate_pct) },
            { key: 'new_opportunities', header: 'Opps', align: 'right' },
            { key: 'won_opportunities', header: 'Won', align: 'right' },
            {
              key: 'drill',
              header: 'Drill',
              render: (row) => (
                <Button size="sm" variant="ghost" onClick={() => setSelectedOrgId(row.organization_id)}>
                  Drill
                </Button>
              ),
            },
          ]}
          rows={orgRows.slice(0, 40)}
          emptyLabel="No organization snapshot rows for selected month"
        />
      </section>

      {selectedOrg ? (
        <section className="rounded-md border border-border bg-surface-elevated p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-content-tertiary">Organization Drill</p>
              <p className="text-sm text-content-primary">{selectedOrg.organization_name} · {selectedOrg.current_plan_name} · {selectedOrg.organization_status}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => router.push(`/terminal/unit-economics?customer=${selectedOrg.organization_id}`)}>
              Open Unit Econ
            </Button>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <StatCell label="Revenue" value={usd(selectedOrg.recognized_revenue_usd)} />
            <StatCell label="Spend" value={usd(selectedOrg.total_spend_usd)} />
            <StatCell label="MRR" value={usd(selectedOrg.mrr_usd)} />
            <StatCell label="Runs" value={selectedOrg.total_runs.toLocaleString()} />
            <StatCell label="Success" value={pct(selectedOrg.success_rate_pct)} />
            <StatCell label="Pipeline" value={usd(selectedOrg.pipeline_open_usd)} />
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <MiniSeriesChart labels={orgLabels} series={orgSeries} />
            <Card variant="default" className="p-3">
              <p className="text-xs uppercase tracking-wide text-content-tertiary">Latest MoM Deltas</p>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <StatCell label="Revenue MoM" value={pct(selectedOrg.mom_revenue_growth_pct)} />
                <StatCell label="Runs MoM" value={pct(selectedOrg.mom_runs_growth_pct)} />
                <StatCell label="Spend MoM" value={pct(selectedOrg.mom_spend_growth_pct)} />
                <StatCell label="Win Rate" value={pct(asPct(selectedOrg.won_opportunities, selectedOrg.new_opportunities))} />
                <StatCell label="Gross Margin" value={usd(selectedOrg.gross_margin_proxy_usd)} />
              </div>
            </Card>
          </div>

          <DataTable<OrgHistoryRow>
            columns={[
              { key: 'month_start', header: 'Month', render: (row) => shortMonth(row.month_start) },
              { key: 'recognized_revenue_usd', header: 'Revenue', align: 'right', render: (row) => usd(row.recognized_revenue_usd) },
              { key: 'total_spend_usd', header: 'Spend', align: 'right', render: (row) => usd(row.total_spend_usd) },
              { key: 'total_runs', header: 'Runs', align: 'right', render: (row) => row.total_runs.toLocaleString() },
              { key: 'mom_revenue_growth_pct', header: 'Rev MoM', align: 'right', render: (row) => pct(row.mom_revenue_growth_pct) },
              { key: 'mom_runs_growth_pct', header: 'Runs MoM', align: 'right', render: (row) => pct(row.mom_runs_growth_pct) },
            ]}
            rows={[...orgHistory].reverse().slice(0, 12).reverse()}
            emptyLabel="No monthly history found for selected organization"
          />
        </section>
      ) : null}
    </TerminalShell>
  );
}
