'use client';

import Link from 'next/link';
import { KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Badge, SearchInput } from '@/components/ui';
import { findTerminalFunction, resolveTerminalCommandHref, VISIBLE_TERMINAL_FUNCTIONS } from '@/lib/terminalFunctions';

interface TerminalShellProps {
  title: string;
  subtitle: string;
  active: 'chat' | 'overview' | 'review' | 'executive' | 'gtm' | 'growth' | 'product' | 'finance' | 'unit' | 'ops' | 'meta';
  children: ReactNode;
  search?: ReactNode;
  headerMeta?: ReactNode;
  sidebarExtra?: ReactNode;
}

const NAV_ITEMS: { key: TerminalShellProps['active']; label: string; href: string }[] = [
  { key: 'chat', label: 'Chat', href: '/terminal/chat' },
  { key: 'overview', label: 'Overview', href: '/terminal' },
  { key: 'growth', label: 'GTM', href: '/terminal/growth' },
  { key: 'review', label: 'Leads', href: '/terminal/leads' },
  { key: 'finance', label: 'Finance', href: '/terminal/finance' },
  { key: 'unit', label: 'Unit Econ', href: '/terminal/unit-economics' },
  { key: 'meta', label: 'Meta', href: '/terminal/meta' },
];

function isFunctionLinkActive(pathname: string, href: string): boolean {
  if (href === '/terminal') {
    return pathname === '/terminal';
  }
  if (href === '/customers') {
    return pathname === '/customers' || pathname.startsWith('/customers/');
  }
  return pathname === href;
}

interface ShellSearchSuggestion {
  key: string;
  label: string;
  hint: string;
  href: string;
}

interface ShellMetadataTable {
  table: string;
  table_schema: string;
  table_name: string;
  column_count: number;
}

interface MetadataSearchResult {
  result_type: string;
  name: string;
  table_key?: string;
}

interface CustomerSearchResult {
  organization_id: string;
  organization_name: string;
  plan_name: string;
}

function isUnitEconomicsCommand(query: string): boolean {
  return /^(?:ue|unit|econ|margin)(?:[\s.]|$)/i.test(query.trim());
}

function extractUnitEconomicsQuery(query: string): string {
  return query.trim().replace(/^(?:ue|unit|econ|margin)(?:[\s.:-]+)?/i, '').trim().toLowerCase();
}

function schemaObjectHref(tableSchema: string, tableName: string): string {
  const schema = tableSchema.toLowerCase();
  const table = tableName.toLowerCase();

  if (table.includes('unit_economics')) return '/terminal/unit-economics';

  if (schema === 'finance') return '/terminal/finance';
  if (schema === 'product') return '/terminal/product';
  if (schema === 'ops' || schema === 'eng') return '/terminal/executive';

  if (schema === 'growth') {
    return '/terminal/growth';
  }

  if (schema === 'core' || schema === 'silver' || schema === 'bronze_supabase') {
    if (table.includes('campaign') || table.includes('lead') || table.includes('opportunit')) return '/terminal/growth';
    if (table.includes('session') || table.includes('run') || table.includes('event')) return '/terminal/product';
    if (table.includes('subscription') || table.includes('invoice') || table.includes('revenue') || table.includes('mrr')) return '/terminal/finance';
    return '/terminal/executive';
  }

  return '/terminal/executive';
}

function objectNameToHref(name: string, tableKey?: string): string {
  const target = String(tableKey || name || '').trim();
  if (!target.includes('.')) return '/terminal/executive';
  const [schema, ...rest] = target.split('.');
  return schemaObjectHref(schema, rest.join('.'));
}

function DefaultTerminalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [showTypeahead, setShowTypeahead] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [tables, setTables] = useState<ShellMetadataTable[]>([]);
  const [remoteResults, setRemoteResults] = useState<MetadataSearchResult[]>([]);
  const [customers, setCustomers] = useState<CustomerSearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadTables() {
      try {
        const response = await fetch('/api/metadata/llm-context?table_limit=120&metric_limit=0&column_limit=0');
        if (!response.ok) return;
        const payload = await response.json();
        const raw = payload?.context?.tables;
        if (!mounted || !Array.isArray(raw)) return;
        setTables(
          raw
            .map((row) => ({
              table: String(row.table ?? ''),
              table_schema: String(row.table_schema ?? ''),
              table_name: String(row.table_name ?? ''),
              column_count: Number(row.column_count ?? 0),
            }))
            .filter((row) => row.table.length > 0 && row.table_schema.length > 0),
        );
      } catch {
        // Keep search usable with nav-only suggestions.
      }
    }
    loadTables();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadCustomers() {
      try {
        const response = await fetch('/api/reports/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: `
              WITH latest_month AS (
                SELECT MAX(metric_month) AS metric_month
                FROM fin.agg_customer_unit_economics_monthly
              )
              SELECT
                c.organization_id,
                MAX(c.organization_name) AS organization_name,
                COALESCE(MAX(c.primary_plan_name), 'unknown') AS plan_name
              FROM fin.agg_customer_unit_economics_monthly c
              JOIN latest_month lm
                ON c.metric_month = lm.metric_month
              GROUP BY 1
              ORDER BY MAX(c.total_session_hours) DESC
              LIMIT 200
            `,
          }),
        });
        if (!response.ok) return;
        const payload = await response.json();
        const rows = payload?.data;
        if (!mounted || !Array.isArray(rows)) return;
        setCustomers(
          rows
            .map((row) => ({
              organization_id: String(row.organization_id ?? ''),
              organization_name: String(row.organization_name ?? ''),
              plan_name: String(row.plan_name ?? 'unknown'),
            }))
            .filter((row) => row.organization_id.length > 0 && row.organization_name.length > 0),
        );
      } catch {
        // Customer typeahead is best-effort.
      }
    }
    loadCustomers();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [query]);

  useEffect(() => {
    const onGlobalKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isEditable) return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        inputRef.current?.focus();
        setShowTypeahead(true);
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setRemoteResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/metadata/search?q=${encodeURIComponent(term)}&limit=8`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = await response.json();
        const results = payload?.search?.results;
        if (!Array.isArray(results)) return;
        setRemoteResults(
          results
            .map((row) => ({
              result_type: String(row.result_type ?? ''),
              name: String(row.name ?? ''),
              table_key: row.table_key ? String(row.table_key) : undefined,
            }))
            .filter((row) => row.name.length > 0),
        );
      } catch {
        // Remote search is opportunistic.
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const suggestions = useMemo<ShellSearchSuggestion[]>(() => {
    const functionSuggestions: ShellSearchSuggestion[] = VISIBLE_TERMINAL_FUNCTIONS.map((fn) => ({
      key: `fn-${fn.code.toLowerCase()}`,
      label: fn.usage,
      hint: `Function · ${fn.title} · ${fn.primaryModel}`,
      href: fn.route,
    }));
    const functionShortcutSuggestions: ShellSearchSuggestion[] = [
      { key: 'fn-short-ov-lm', label: 'OV.LM', hint: 'Function shortcut · Overview last month', href: '/terminal' },
      { key: 'fn-short-ov-this', label: 'OV.THIS', hint: 'Function shortcut · Overview current month', href: '/terminal' },
      { key: 'fn-short-ov-m2', label: 'OV.M-2', hint: 'Function shortcut · Overview two months ago', href: '/terminal' },
      { key: 'fn-short-meta-schema', label: 'META.SCHEMA', hint: 'Function shortcut · Metadata schema panel', href: '/terminal/meta?panel=schema' },
      { key: 'fn-short-meta-dict', label: 'META.DICT', hint: 'Function shortcut · Metadata dictionary panel', href: '/terminal/meta?panel=dictionary' },
    ];

    const viewSuggestions = NAV_ITEMS.map((item) => ({
      key: `view-${item.key}`,
      label: item.label,
      hint: 'Terminal View',
      href: item.href,
    }));

    const schemaSuggestions = tables.slice(0, 60).map((table) => ({
      key: `schema-${table.table}`,
      label: table.table,
      hint: `Schema object · ${table.column_count} cols`,
      href: schemaObjectHref(table.table_schema, table.table_name),
    }));

    const dynamicSuggestions = remoteResults.map((row) => ({
      key: `search-${row.result_type}-${row.name}`,
      label: row.name,
      hint: `${row.result_type} result`,
      href: objectNameToHref(row.name, row.table_key),
    }));

    const ueCustomerSuggestions = customers.slice(0, 80).map((customer) => ({
      key: `ue-customer-${customer.organization_id}`,
      label: `UE ${customer.organization_name} (${customer.organization_id})`,
      hint: `Unit Econ · ${customer.plan_name} · ${customer.organization_id}`,
      href: `/terminal/unit-economics?customer=${encodeURIComponent(customer.organization_id)}`,
    }));

    return [
      ...functionShortcutSuggestions,
      ...functionSuggestions,
      ...ueCustomerSuggestions,
      ...viewSuggestions,
      ...dynamicSuggestions,
      ...schemaSuggestions,
    ];
  }, [customers, remoteResults, tables]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const ueMode = isUnitEconomicsCommand(query);
    const ueTerm = extractUnitEconomicsQuery(query);
    const ueSuggestions = suggestions.filter((item) => item.key.startsWith('ue-customer-'));

    if (ueMode) {
      if (!ueTerm) return ueSuggestions.slice(0, 12);
      return ueSuggestions
        .filter((item) => {
          const full = `${item.label} ${item.hint}`.toLowerCase();
          return full.includes(ueTerm);
        })
        .slice(0, 12);
    }

    if (!term) {
      return suggestions.filter((item) => item.href !== pathname).slice(0, 8);
    }
    return suggestions
      .filter((item) => {
        const full = `${item.label} ${item.hint}`.toLowerCase();
        return full.includes(term);
      })
      .slice(0, 12);
  }, [pathname, query, suggestions]);

  const activeFunction = useMemo(() => {
    const firstToken = query.trim().split(/\s+/)[0] || '';
    return findTerminalFunction(firstToken);
  }, [query]);

  const selectSuggestion = (item: ShellSearchSuggestion) => {
    setQuery(item.label);
    setShowTypeahead(false);
    if (item.href !== pathname) {
      router.push(item.href);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      if (filtered.length === 0) return;
      event.preventDefault();
      setShowTypeahead(true);
      setActiveSuggestionIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      if (filtered.length === 0) return;
      event.preventDefault();
      setShowTypeahead(true);
      setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Tab') {
      if (activeFunction) {
        event.preventDefault();
        setQuery(activeFunction.usage);
        return;
      }
      if (filtered.length > 0) {
        event.preventDefault();
        const item = filtered[activeSuggestionIndex] || filtered[0];
        setQuery(item.label);
        return;
      }
    }

    if (event.key === 'Enter') {
      const isUeQuery = isUnitEconomicsCommand(query);
      if (isUeQuery) {
        event.preventDefault();
        const ueItems = filtered.filter((item) => item.key.startsWith('ue-customer-'));
        if (ueItems.length > 0) {
          selectSuggestion(ueItems[0]);
        } else if (pathname !== '/terminal/unit-economics') {
          router.push('/terminal/unit-economics');
        }
        return;
      }
      const commandHref = resolveTerminalCommandHref(query);
      if (commandHref) {
        event.preventDefault();
        setShowTypeahead(false);
        if (commandHref !== pathname) router.push(commandHref);
        return;
      }
      if (filtered.length > 0) {
        event.preventDefault();
        const item = filtered[activeSuggestionIndex] || filtered[0];
        selectSuggestion(item);
      }
    }
  };

  return (
    <div className="relative">
      <SearchInput
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setShowTypeahead(true);
        }}
        onFocus={() => setShowTypeahead(true)}
        onBlur={() => setTimeout(() => setShowTypeahead(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="Try: OV, OV THIS MONTH, GTM, FIN, UE <customer>, META  (/ to focus)"
      />
      {activeFunction ? (
        <div className="mt-1 rounded border border-border bg-surface-primary px-2 py-1 text-[11px] text-content-secondary">
          <span className="font-semibold text-content-primary">{activeFunction.code}</span>
          {` · ${activeFunction.summary} · Usage: ${activeFunction.usage}`}
        </div>
      ) : null}
      {showTypeahead ? (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface-elevated shadow-medium">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-content-tertiary">No matches</div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.key}
                className={`w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-tertiary ${
                  index === activeSuggestionIndex ? 'bg-surface-tertiary' : ''
                }`}
                onMouseDown={() => selectSuggestion(item)}
              >
                <p className={`text-xs font-medium text-content-primary ${item.key.startsWith('customer-') ? 'pl-2' : ''}`}>{item.label}</p>
                <p className="text-[11px] text-content-tertiary">{item.hint}</p>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function BrowserbaseMark() {
  return (
    <div className="h-8 w-8 bg-content-primary flex items-center justify-center">
      <span className="text-xs font-semibold text-white">B</span>
    </div>
  );
}

export default function TerminalShell({ title, subtitle, active, children, search, headerMeta, sidebarExtra }: TerminalShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onGlobalKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      const isEditable = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isEditable) return;

      if (event.key === '1') {
        event.preventDefault();
        router.push('/terminal');
        return;
      }
      if (event.key === '2') {
        event.preventDefault();
        router.push('/terminal/growth');
        return;
      }
      if (event.key === '3') {
        event.preventDefault();
        router.push('/terminal/leads');
      }
    };

    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [router]);

  return (
    <div
      className="min-h-screen bg-surface-secondary text-content-primary"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(209,213,219,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(209,213,219,0.45) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[220px_1fr]">
        <aside className="border-b border-accent-active bg-accent p-3 text-white lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center gap-2 rounded border border-white/25 bg-white/10 px-2 py-2">
            <BrowserbaseMark />
            <div>
              <p className="text-sm font-semibold leading-none">BrowserBase</p>
              <p className="mt-1 text-xs text-white/80">Intelligence Terminal</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            <Link
              href="/terminal/chat"
              prefetch={false}
              className={`block rounded px-2 py-2 text-left text-xs transition-colors ${
                active === 'chat'
                  ? 'border border-white/40 bg-white/20 text-white'
                  : 'border border-white/20 bg-white/10 text-white/90 hover:bg-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">CHAT</span>
                <span className="text-[10px] text-white/70">Assistant</span>
              </div>
            </Link>
            {VISIBLE_TERMINAL_FUNCTIONS.map((fn) => (
              <Link
                key={fn.code}
                href={fn.route}
                prefetch={false}
                className={`block rounded px-2 py-2 text-xs transition-colors ${
                  isFunctionLinkActive(pathname, fn.route)
                    ? 'border border-white/40 bg-white/20 text-white'
                    : 'border border-white/20 bg-white/10 text-white/90 hover:bg-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{fn.code}</span>
                  <span className="text-[10px] text-white/70">{fn.title}</span>
                </div>
              </Link>
            ))}
          </div>

          {sidebarExtra ? <div className="mt-4 lg:mt-4">{sidebarExtra}</div> : null}
        </aside>

        <main className="p-3">
          <div className="mb-3 flex flex-col gap-3 rounded border border-border bg-surface-primary px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 lg:max-w-sm">
              <div className="flex items-center gap-2">
                <BrowserbaseMark />
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-content-tertiary">{subtitle}</p>
                </div>
              </div>
            </div>

            <div className="w-full lg:max-w-xl lg:flex-1">{search || <DefaultTerminalSearch />}</div>

            <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
              <Link
                href="/chat"
                prefetch={false}
                className="rounded border border-border bg-surface-secondary px-2 py-1 text-xs font-medium text-content-primary hover:bg-surface-tertiary"
              >
                Full
              </Link>
              {headerMeta || <Badge variant="accent">LIVE</Badge>}
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
