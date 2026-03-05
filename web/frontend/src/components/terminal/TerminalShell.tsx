'use client';

import Link from 'next/link';
import { KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Badge, SearchInput } from '@/components/ui';
import { findTerminalFunction, resolveTerminalCommandHref, VISIBLE_TERMINAL_FUNCTIONS } from '@/lib/terminalFunctions';

interface TerminalShellProps {
  title: string;
  subtitle: string;
  active: 'overview' | 'executive' | 'gtm' | 'growth' | 'product' | 'finance' | 'ops' | 'meta';
  children: ReactNode;
  search?: ReactNode;
  headerMeta?: ReactNode;
  sidebarExtra?: ReactNode;
}

const NAV_ITEMS: { key: TerminalShellProps['active']; label: string; href: string }[] = [
  { key: 'overview', label: 'Overview', href: '/terminal' },
  { key: 'executive', label: 'Executive', href: '/terminal/executive' },
  { key: 'gtm', label: 'GTM', href: '/terminal/gtm' },
  { key: 'growth', label: 'Growth', href: '/terminal/growth' },
  { key: 'product', label: 'Product', href: '/terminal/product' },
  { key: 'finance', label: 'Finance', href: '/terminal/finance' },
  { key: 'ops', label: 'Ops', href: '/terminal/ops' },
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
}

function isCustomerCommand(query: string): boolean {
  return /^(?:cus|cust|cuss|customer)(?:[\s.]|$)/i.test(query.trim());
}

function extractCustomerQuery(query: string): string {
  return query.trim().replace(/^(?:cus|cust|cuss|customer)(?:[\s.:-]+)?/i, '').trim().toLowerCase();
}

function schemaObjectHref(tableSchema: string, tableName: string): string {
  const schema = tableSchema.toLowerCase();
  const table = tableName.toLowerCase();

  if (schema === 'finance') return '/terminal/finance';
  if (schema === 'product') return '/terminal/product';
  if (schema === 'ops' || schema === 'eng') return '/terminal/ops';

  if (schema === 'growth') {
    if (table.includes('campaign') || table.includes('pipeline') || table.includes('lead') || table.includes('opportunit')) {
      return '/terminal/gtm';
    }
    return '/terminal/growth';
  }

  if (schema === 'core' || schema === 'silver' || schema === 'bronze_supabase') {
    if (table.includes('campaign') || table.includes('lead') || table.includes('opportunit')) return '/terminal/gtm';
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
              SELECT
                organization_id,
                organization_name
              FROM fin.agg_revenue_monthly
              GROUP BY 1, 2
              ORDER BY MAX(realized_revenue_usd) DESC
              LIMIT 120
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
      { key: 'fn-short-cus', label: 'CUS.<org>', hint: 'Function shortcut · Customer drill', href: '/customers' },
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

    const customerSuggestions = customers.slice(0, 80).map((customer) => ({
      key: `customer-${customer.organization_id}`,
      label: `CUS ${customer.organization_name} (${customer.organization_id})`,
      hint: `Customer · ${customer.organization_name} · ${customer.organization_id}`,
      href: `/customers/${encodeURIComponent(customer.organization_id)}`,
    }));

    return [...functionShortcutSuggestions, ...functionSuggestions, ...customerSuggestions, ...viewSuggestions, ...dynamicSuggestions, ...schemaSuggestions];
  }, [customers, remoteResults, tables]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const customerMode = isCustomerCommand(query);
    const customerTerm = extractCustomerQuery(query);
    const customerSuggestions = suggestions.filter((item) => item.key.startsWith('customer-'));

    if (customerMode) {
      if (!customerTerm) return customerSuggestions.slice(0, 12);
      return customerSuggestions
        .filter((item) => {
          const full = `${item.label} ${item.hint}`.toLowerCase();
          return full.includes(customerTerm);
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
      const isCustomerQuery = isCustomerCommand(query);
      if (isCustomerQuery) {
        event.preventDefault();
        if (filtered.length > 0) {
          const customerItem = filtered.find((item) => item.key.startsWith('customer-')) || filtered[0];
          selectSuggestion(customerItem);
        } else if (pathname !== '/customers') {
          router.push('/customers');
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
        placeholder="Type: OV, OV.LM, OV.THIS, SC, GTM, FIN, OPS, META, ABOUT, CUS.<org>  (/ to focus)"
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
            <BrowserbaseMark />
            <div>
              <p className="text-sm font-semibold leading-none">BrowserBase</p>
              <p className="mt-1 text-xs text-white/80">Intelligence Terminal</p>
            </div>
          </div>

          <div className="space-y-1">
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

          {sidebarExtra ? <div className="mt-4">{sidebarExtra}</div> : null}
        </aside>

        <main className="p-3">
          <div className="mb-3 flex items-center justify-between gap-3 rounded border border-border bg-surface-primary px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BrowserbaseMark />
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-content-tertiary">{subtitle}</p>
                </div>
              </div>
            </div>

            <div className="w-full max-w-xl">{search || <DefaultTerminalSearch />}</div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/chat"
                prefetch={false}
                className="rounded border border-border bg-surface-secondary px-2 py-1 text-xs font-medium text-content-primary hover:bg-surface-tertiary"
              >
                Chat
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
