'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AIAnswerBlock,
  AppShell,
  Badge,
  Button,
  Card,
  DataTable,
  DocCompletenessMeter,
  Drawer,
  EmptyState,
  Input,
  LineageEdgeLegend,
  LineageNodeCard,
  LoadingState,
  OwnershipPill,
  PageHeader,
  SearchInput,
  SidebarNav,
  StatTile,
  Tabs,
} from '@/components/ui';
import { getMonitoringOverview, MonitoringOverview } from '@/lib/api';

type ExplorerTab = 'overview' | 'objects' | 'lineage' | 'centralization' | 'sql';
type DomainId = 'customer' | 'runtime' | 'commercial' | 'growth' | 'ops';

interface QueryPayload {
  success: boolean;
  data?: Record<string, unknown>[];
  columns?: string[];
  row_count?: number;
  truncated?: boolean;
  error?: string;
}

interface TablesCatalogPayload {
  success: boolean;
  detail?: string;
  catalog?: {
    generated_at: string;
    schemas: string[];
    table_count: number;
    tables: Array<{
      table: string;
      table_schema: string;
      table_name: string;
      column_count: number;
      owner?: string;
      certified?: boolean;
      freshness_column?: string | null;
      freshest_at?: string | null;
    }>;
  };
}

interface DomainSummary {
  id: DomainId;
  label: string;
  purpose: string;
  tables: string[];
}

interface WarehouseObject {
  id: string;
  schema: string;
  table: string;
  domain: DomainId;
  kind: 'entity' | 'fact' | 'metric';
  columnCount: number;
  owner?: string;
  certified?: boolean;
  freshness?: string | null;
  rowCount?: number;
}

interface LineageRow {
  businessObject: string;
  source: string;
  bronze: string;
  silver: string;
  analytics: string;
  metric: string;
  signal: string;
}

interface CentralizationStep {
  id: string;
  name: string;
  purpose: string;
  owner: string;
  sla: string;
  systems: string[];
}

const DOMAIN_ORDER: DomainId[] = ['customer', 'runtime', 'commercial', 'growth', 'ops'];

const DOMAIN_META: Record<DomainId, { label: string; purpose: string }> = {
  customer: {
    label: 'Customer Domain',
    purpose: 'Identity and account lifecycle entities used by all teams.',
  },
  runtime: {
    label: 'Runtime Domain',
    purpose: 'Browser/session execution events and product usage telemetry.',
  },
  commercial: {
    label: 'Commercial Domain',
    purpose: 'Revenue, subscription, billing, and finance operations.',
  },
  growth: {
    label: 'Growth Domain',
    purpose: 'GTM funnel, campaign, lead, and conversion health models.',
  },
  ops: {
    label: 'Ops Domain',
    purpose: 'Reliability, quality, and operating-system metrics.',
  },
};

const TABS = [
  { key: 'overview', label: 'Platform Overview' },
  { key: 'objects', label: 'Object Explorer' },
  { key: 'lineage', label: 'Lineage Map' },
  { key: 'centralization', label: 'Centralization Flow' },
  { key: 'sql', label: 'SQL Explorer' },
] as const;

const CENTRALIZATION_STEPS: CentralizationStep[] = [
  {
    id: 'capture',
    name: 'Capture',
    purpose: 'Operational systems generate product, billing, and GTM events.',
    owner: 'Data Platform + Domain Apps',
    sla: 'Source availability by provider SLA',
    systems: ['Supabase/Postgres', 'SaaS CRM and finance systems', 'Event producers'],
  },
  {
    id: 'land',
    name: 'Land',
    purpose: 'Replication lands source data into raw bronze schemas.',
    owner: 'Data Platform',
    sla: 'Hourly replication freshness',
    systems: ['pipeline/replicate.py', 'bronze_supabase'],
  },
  {
    id: 'standardize',
    name: 'Standardize',
    purpose: 'Staging and core models clean, cast, and normalize entities.',
    owner: 'Analytics Engineering',
    sla: 'Daily dbt completion before business hours',
    systems: ['dbt staging', 'dbt core (silver)'],
  },
  {
    id: 'model',
    name: 'Model',
    purpose: 'Domain marts and metric layers create decision-ready objects.',
    owner: 'Analytics Engineering + Domain Analysts',
    sla: 'Domain KPI refresh daily',
    systems: ['growth/product/finance/ops marts', 'core_metrics'],
  },
  {
    id: 'serve',
    name: 'Serve',
    purpose: 'Dashboards, workflows, and AI surfaces consume centralized data.',
    owner: 'Business Analytics + AI Team',
    sla: 'Critical dashboards on-time before standups',
    systems: ['Explorer', 'Monitoring', 'Workflow agents', 'Reports UI'],
  },
];

function classifyDomain(name: string): DomainId {
  const lower = name.toLowerCase();
  if (
    lower.includes('organization') ||
    lower.includes('user') ||
    lower.includes('member') ||
    lower.includes('contact') ||
    lower.includes('account')
  ) {
    return 'customer';
  }
  if (
    lower.includes('session') ||
    lower.includes('run') ||
    lower.includes('event') ||
    lower.includes('api_key') ||
    lower.includes('project')
  ) {
    return 'runtime';
  }
  if (
    lower.includes('plan') ||
    lower.includes('subscription') ||
    lower.includes('invoice') ||
    lower.includes('revenue') ||
    lower.includes('mrr') ||
    lower.includes('usage')
  ) {
    return 'commercial';
  }
  if (
    lower.includes('gtm') ||
    lower.includes('lead') ||
    lower.includes('opportunit') ||
    lower.includes('pipeline') ||
    lower.includes('cohort') ||
    lower.includes('growth') ||
    lower.includes('task')
  ) {
    return 'growth';
  }
  return 'ops';
}

function objectKind(name: string): 'entity' | 'fact' | 'metric' {
  const lower = name.toLowerCase();
  if (lower.includes('kpi') || lower.includes('metric') || lower.includes('mrr') || lower.includes('signal')) {
    return 'metric';
  }
  if (lower.includes('fct') || lower.includes('daily') || lower.includes('snapshot') || lower.includes('queue')) {
    return 'fact';
  }
  return 'entity';
}

function pickTable(tables: string[], include: string[], schemaHint?: string): string {
  const matches = tables.filter((table) => {
    const lower = table.toLowerCase();
    if (schemaHint && !lower.startsWith(`${schemaHint.toLowerCase()}.`)) return false;
    return include.every((token) => lower.includes(token));
  });
  return matches[0] || 'n/a';
}

function formatDate(value?: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function freshnessBadge(value?: string | null): { label: string; variant: 'success' | 'warning' | 'error' } {
  if (!value) return { label: 'Unknown', variant: 'warning' };
  const ageMs = Date.now() - new Date(value).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  if (ageHours <= 24) return { label: 'On SLA', variant: 'success' };
  if (ageHours <= 48) return { label: 'At Risk', variant: 'warning' };
  return { label: 'Breached', variant: 'error' };
}

export default function ExplorerPage() {
  const [activeTab, setActiveTab] = useState<ExplorerTab>('overview');
  const [activeDomain, setActiveDomain] = useState<DomainId>('growth');
  const [search, setSearch] = useState('');
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [schemaFilter, setSchemaFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'entity' | 'fact' | 'metric'>('all');
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [sqlText, setSqlText] = useState('SELECT * FROM core.daily_kpis ORDER BY date DESC LIMIT 50');
  const [sqlResults, setSqlResults] = useState<Record<string, unknown>[]>([]);
  const [sqlColumns, setSqlColumns] = useState<string[]>([]);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlTruncated, setSqlTruncated] = useState(false);
  const [tableColumns, setTableColumns] = useState<Record<string, number>>({});
  const [tableMeta, setTableMeta] = useState<Record<string, { owner?: string; certified?: boolean }>>({});
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [tablesResponse, monitoring] = await Promise.all([
          fetch('/api/metadata/tables'),
          getMonitoringOverview(),
        ]);

        const payload = (await tablesResponse.json()) as TablesCatalogPayload;
        if (!tablesResponse.ok || !payload.success || !payload.catalog) {
          throw new Error(payload.detail || 'Failed to load warehouse metadata');
        }

        const next: Record<string, number> = {};
        const nextMeta: Record<string, { owner?: string; certified?: boolean }> = {};
        for (const table of payload.catalog.tables) {
          next[table.table] = Number(table.column_count || 0);
          nextMeta[table.table] = {
            owner: table.owner,
            certified: table.certified,
          };
        }

        setTableColumns(next);
        setTableMeta(nextMeta);
        setOverview(monitoring);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load explorer data');
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  const allTables = useMemo(() => Object.keys(tableColumns), [tableColumns]);

  const domainSummaries = useMemo<DomainSummary[]>(() => {
    const byDomain: Record<DomainId, string[]> = {
      customer: [],
      runtime: [],
      commercial: [],
      growth: [],
      ops: [],
    };

    for (const table of allTables) {
      byDomain[classifyDomain(table)].push(table);
    }

    return DOMAIN_ORDER.map((id) => ({
      id,
      label: DOMAIN_META[id].label,
      purpose: DOMAIN_META[id].purpose,
      tables: byDomain[id].sort(),
    }));
  }, [allTables]);

  const freshnessByTable = useMemo(() => {
    const map: Record<string, { freshestAt: string | null; rowCount: number }> = {};
    if (!overview) return map;
    for (const table of overview.tables) {
      map[`${table.schema}.${table.table}`] = {
        freshestAt: table.freshest_at,
        rowCount: table.row_count,
      };
    }
    return map;
  }, [overview]);

  const objects = useMemo<WarehouseObject[]>(() => {
    return allTables
      .map((id) => {
        const [schema, table] = id.split('.');
        const freshness = freshnessByTable[id];
        return {
          id,
          schema,
          table,
          domain: classifyDomain(id),
          kind: objectKind(id),
          columnCount: tableColumns[id] || 0,
          owner: tableMeta[id]?.owner,
          certified: Boolean(tableMeta[id]?.certified),
          freshness: freshness?.freshestAt,
          rowCount: freshness?.rowCount,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [allTables, freshnessByTable, tableColumns, tableMeta]);

  const filteredObjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return objects.filter((object) => {
      if (object.domain !== activeDomain) return false;
      if (schemaFilter !== 'all' && object.schema !== schemaFilter) return false;
      if (typeFilter !== 'all' && object.kind !== typeFilter) return false;
      if (certifiedOnly && !object.certified) return false;
      if (!term) return true;
      return object.id.toLowerCase().includes(term) || object.kind.toLowerCase().includes(term);
    });
  }, [activeDomain, objects, search, schemaFilter, typeFilter, certifiedOnly]);

  const availableSchemas = useMemo(() => {
    const schemas = new Set(
      objects
        .filter((object) => object.domain === activeDomain)
        .map((object) => object.schema),
    );
    return ['all', ...Array.from(schemas).sort()];
  }, [activeDomain, objects]);

  const globalSearchMatches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return objects
      .filter((object) => {
        return (
          object.id.toLowerCase().includes(term) ||
          object.schema.toLowerCase().includes(term) ||
          object.table.toLowerCase().includes(term) ||
          object.kind.toLowerCase().includes(term) ||
          DOMAIN_META[object.domain].label.toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [objects, search]);

  useEffect(() => {
    if (!selectedObjectId && filteredObjects.length > 0) {
      setSelectedObjectId(filteredObjects[0].id);
    }
  }, [filteredObjects, selectedObjectId]);

  const selectedObject = useMemo(
    () => filteredObjects.find((object) => object.id === selectedObjectId) || null,
    [filteredObjects, selectedObjectId],
  );

  const lineageRows = useMemo<LineageRow[]>(() => {
    return [
      {
        businessObject: 'Trial Conversion Risk',
        source: 'public.organizations, public.browser_sessions',
        bronze: pickTable(allTables, ['bronze_supabase', 'organizations']),
        silver: pickTable(allTables, ['core', 'fct_runs']),
        analytics: pickTable(allTables, ['growth', 'growth_daily']),
        metric: pickTable(allTables, ['growth', 'growth_kpis']),
        signal: pickTable(allTables, ['signal', 'trial', 'risk']),
      },
      {
        businessObject: 'MRR',
        source: 'public.subscriptions, public.invoices',
        bronze: pickTable(allTables, ['bronze_supabase', 'subscriptions']),
        silver: pickTable(allTables, ['core', 'fct_subscriptions']),
        analytics: pickTable(allTables, ['finance', 'monthly_revenue']),
        metric: pickTable(allTables, ['finance', 'mrr']),
        signal: pickTable(allTables, ['growth', 'growth_task_queue']),
      },
      {
        businessObject: 'Run Reliability',
        source: 'public.browser_sessions, public.session_events',
        bronze: pickTable(allTables, ['bronze_supabase', 'browser_sessions']),
        silver: pickTable(allTables, ['core', 'fct_events']),
        analytics: pickTable(allTables, ['eng', 'engineering_daily']),
        metric: pickTable(allTables, ['eng', 'engineering_kpis']),
        signal: pickTable(allTables, ['ops', 'ops_kpis']),
      },
    ];
  }, [allTables]);

  const filteredLineageRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return lineageRows;
    return lineageRows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(term));
  }, [lineageRows, search]);

  useEffect(() => {
    function focusSearchInput() {
      const input = searchContainerRef.current?.querySelector('input');
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typingInField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focusSearchInput();
        return;
      }

      if (!typingInField && event.key === '/') {
        event.preventDefault();
        focusSearchInput();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function runSqlQuery() {
    setSqlLoading(true);
    setSqlError(null);
    setSqlResults([]);
    setSqlColumns([]);
    setSqlTruncated(false);
    try {
      const response = await fetch('/api/reports/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlText, actor: 'explorer.sql' }),
      });
      const payload = (await response.json()) as QueryPayload;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Query failed');
      }
      setSqlResults(payload.data || []);
      setSqlColumns(payload.columns || []);
      setSqlTruncated(Boolean(payload.truncated));
    } catch (err) {
      setSqlError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setSqlLoading(false);
    }
  }

  const docScore = useMemo(() => {
    if (!selectedObject) return 72;
    let score = 45;
    if (selectedObject.columnCount > 0) score += 20;
    if (selectedObject.freshness) score += 20;
    if (selectedObject.rowCount !== undefined) score += 15;
    return Math.min(score, 100);
  }, [selectedObject]);

  const staleTables = overview?.tables.filter((table) => {
    if (!table.freshest_at) return true;
    const ageHours = (Date.now() - new Date(table.freshest_at).getTime()) / (1000 * 60 * 60);
    return ageHours > 24;
  }).length || 0;

  const navItems = [
    {
      href: '/explorer',
      label: 'Data Platform',
      active: true,
      badge: `${allTables.length}`,
    },
    {
      href: '/monitoring',
      label: 'Monitoring',
      active: false,
      badge: overview ? `${overview.tables.length}` : undefined,
    },
    {
      href: '/ontology',
      label: 'Ontology',
      active: false,
      badge: `${domainSummaries.length}`,
    },
    {
      href: '/docs/sources-of-truth',
      label: 'Sources of Truth',
      active: false,
    },
  ];

  if (isLoading) {
    return (
      <AppShell sidebar={<SidebarNav title="Platform" items={navItems} />}>
        <LoadingState title="Loading data platform" description="Fetching warehouse metadata, lineage, and monitoring status." />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell sidebar={<SidebarNav title="Platform" items={navItems} />}>
        <EmptyState title="Explorer unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </AppShell>
    );
  }

  return (
    <AppShell sidebar={<SidebarNav title="Platform" items={navItems} />}>
      <div className="space-y-4">
        <PageHeader
          title="Data Platform Explorer"
          subtitle="Track where data comes from, how it gets centralized, and what powers decisions."
          actions={
            <>
              <Button variant="secondary" onClick={() => setActiveTab('sql')}>Open SQL Explorer</Button>
              <Button onClick={() => setActiveTab('objects')}>Browse Objects</Button>
            </>
          }
          filters={
            <>
              <Tabs
                items={TABS.map((tab) => ({ key: tab.key, label: tab.label }))}
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as ExplorerTab)}
              />
              <div ref={searchContainerRef} className="min-w-[260px]">
                <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search objects, lineage, or metrics" />
              </div>
            </>
          }
        />
        {search.trim() ? (
          <Card variant="default" className="p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-content-tertiary">Quick matches for “{search.trim()}”</p>
              <Badge variant="neutral">{globalSearchMatches.length}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {globalSearchMatches.length === 0 ? (
                <p className="text-sm text-content-secondary">No objects match this search.</p>
              ) : (
                globalSearchMatches.map((object) => (
                  <Button
                    key={object.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setActiveTab('objects');
                      setActiveDomain(object.domain);
                      setSelectedObjectId(object.id);
                      setDrawerOpen(true);
                    }}
                  >
                    {object.id}
                  </Button>
                ))
              )}
            </div>
          </Card>
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Warehouse Objects" value={`${allTables.length}`} delta="Live metadata from API catalog" trend="neutral" />
          <StatTile label="Schemas" value={`${overview?.schema_summary.table_count ? Object.keys(overview.by_schema).length : 0}`} delta={`${overview?.schema_summary.column_count || 0} tracked columns`} trend="neutral" />
          <StatTile label="Stale Tables" value={`${staleTables}`} delta="Older than 24 hours" trend={staleTables > 0 ? 'down' : 'up'} />
          <StatTile label="Schema Drift" value={`${overview?.schema_drift.changed_tables.length || 0}`} delta={overview?.schema_drift.baseline_exists ? 'Compared to saved baseline' : 'No baseline yet'} trend={(overview?.schema_drift.changed_tables.length || 0) > 0 ? 'down' : 'up'} />
        </section>

        {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card variant="elevated" className="p-4 xl:col-span-2">
              <h2 className="text-sm font-semibold text-content-primary">Domain Map</h2>
              <p className="mt-1 text-sm text-content-secondary">Business domains and the objects they own in the centralized platform.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {domainSummaries.map((domain) => (
                  <LineageNodeCard
                    key={domain.id}
                    title={domain.label}
                    type="model"
                    owner="Domain Analytics"
                    sla="Daily by 8:00 AM"
                    qualityScore={Math.max(70, Math.min(99, 70 + domain.tables.length))}
                  />
                ))}
              </div>
            </Card>

            <Card variant="elevated" className="p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-content-primary">AI Documentation Health</h2>
                <p className="mt-1 text-xs text-content-secondary">Readiness score for object-level docs used by humans and AI.</p>
              </div>
              <DocCompletenessMeter score={docScore} threshold={80} />
              <OwnershipPill owner="Data Platform" steward="Analytics Eng" />
              <AIAnswerBlock
                answer={`The platform currently tracks ${allTables.length} objects across ${domainSummaries.length} domains. ${staleTables > 0 ? `${staleTables} tables are outside a 24-hour freshness target and should be prioritized.` : 'All monitored tables are within freshness targets.'}`}
                citations={[
                  { id: 'overview.tables', label: 'monitoring.overview.tables' },
                  { id: 'schema.summary', label: 'monitoring.schema_summary' },
                  { id: 'objects.catalog', label: 'api.metadata.tables catalog' },
                ]}
                warning={docScore < 80 ? 'Documentation completeness is below target for reliable AI consumption.' : undefined}
              />
            </Card>
          </div>
        ) : null}

        {activeTab === 'objects' ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card variant="elevated" className="p-4 xl:col-span-3">
              <h2 className="text-sm font-semibold text-content-primary">Domains</h2>
              <div className="mt-3 space-y-2">
                {domainSummaries.map((domain) => (
                  <Button
                    key={domain.id}
                    variant={activeDomain === domain.id ? 'primary' : 'secondary'}
                    className="w-full justify-between"
                    onClick={() => setActiveDomain(domain.id)}
                  >
                    <span>{domain.label}</span>
                    <span className="text-xs opacity-80">{domain.tables.length}</span>
                  </Button>
                ))}
              </div>
            </Card>

            <Card variant="elevated" className="p-4 xl:col-span-9">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-content-primary">{DOMAIN_META[activeDomain].label} Objects</h2>
                  <Badge variant="neutral">{filteredObjects.length} objects</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={schemaFilter}
                    onChange={(event) => setSchemaFilter(event.target.value)}
                    className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                  >
                    {availableSchemas.map((schema) => (
                      <option key={schema} value={schema}>
                        {schema === 'all' ? 'All schemas' : schema}
                      </option>
                    ))}
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value as 'all' | 'entity' | 'fact' | 'metric')}
                    className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                  >
                    <option value="all">All types</option>
                    <option value="entity">Entity</option>
                    <option value="fact">Fact</option>
                    <option value="metric">Metric</option>
                  </select>
                  <label className="flex items-center gap-1.5 rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary">
                    <input
                      type="checkbox"
                      checked={certifiedOnly}
                      onChange={(event) => setCertifiedOnly(event.target.checked)}
                      className="h-3 w-3"
                    />
                    Certified only
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSchemaFilter('all');
                      setTypeFilter('all');
                      setCertifiedOnly(false);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="mt-3">
                <DataTable<WarehouseObject>
                  columns={[
                    { key: 'id', header: 'Object' },
                    { key: 'schema', header: 'Schema' },
                    { key: 'kind', header: 'Type' },
                    {
                      key: 'certified',
                      header: 'Certified',
                      render: (row: WarehouseObject) => (
                        <Badge variant={row.certified ? 'success' : 'neutral'}>
                          {row.certified ? 'Yes' : 'No'}
                        </Badge>
                      ),
                    },
                    { key: 'columnCount', header: 'Columns', align: 'right' },
                    {
                      key: 'freshness',
                      header: 'Freshness',
                      render: (row: WarehouseObject) => {
                        const badge = freshnessBadge(row.freshness);
                        return <Badge variant={badge.variant}>{badge.label}</Badge>;
                      },
                    },
                    {
                      key: 'actions',
                      header: '',
                      align: 'right',
                      render: (row: WarehouseObject) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedObjectId(row.id);
                            setDrawerOpen(true);
                          }}
                        >
                          Inspect
                        </Button>
                      ),
                    },
                  ]}
                  rows={filteredObjects}
                  emptyLabel="No objects found for this domain and search."
                />
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'lineage' ? (
          <Card variant="elevated" className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-content-primary">Lineage Map</h2>
                <p className="mt-1 text-sm text-content-secondary">Trace key business objects from source to centralized metrics.</p>
              </div>
              <LineageEdgeLegend />
            </div>
            <div className="mt-3">
              <DataTable<LineageRow>
                columns={[
                  { key: 'businessObject', header: 'Business Object' },
                  { key: 'source', header: 'Source' },
                  { key: 'bronze', header: 'Bronze' },
                  { key: 'silver', header: 'Silver' },
                  { key: 'analytics', header: 'Analytics' },
                  { key: 'metric', header: 'Metric' },
                  { key: 'signal', header: 'Signal' },
                ]}
                rows={filteredLineageRows}
              />
            </div>
          </Card>
        ) : null}

        {activeTab === 'centralization' ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            {CENTRALIZATION_STEPS.map((step) => (
              <Card key={step.id} variant="elevated" className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-content-primary">{step.name}</h3>
                  <Badge variant="accent">Step</Badge>
                </div>
                <p className="mt-2 text-sm text-content-secondary">{step.purpose}</p>
                <div className="mt-3 space-y-2 text-xs">
                  <p className="text-content-secondary"><span className="text-content-tertiary">Owner:</span> {step.owner}</p>
                  <p className="text-content-secondary"><span className="text-content-tertiary">SLA:</span> {step.sla}</p>
                  <p className="text-content-tertiary">Systems</p>
                  <ul className="space-y-1">
                    {step.systems.map((system) => (
                      <li key={system} className="rounded bg-surface-tertiary px-2 py-1 text-content-secondary">{system}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        ) : null}

        {activeTab === 'sql' ? (
          <Card variant="elevated" className="overflow-hidden">
            <div className="border-b border-border bg-surface-secondary px-4 py-3">
              <h2 className="text-sm font-semibold text-content-primary">Live SQL Explorer</h2>
              <p className="mt-1 text-xs text-content-secondary">Type SQL directly below or use the DuckDB local UI iframe.</p>
            </div>
            <div className="space-y-3 p-4">
              <textarea
                value={sqlText}
                onChange={(event) => setSqlText(event.target.value)}
                className="h-40 w-full rounded border border-border bg-surface-primary p-3 font-mono text-xs text-content-primary"
                placeholder="Type SQL..."
              />
              <div className="flex items-center gap-2">
                <Button onClick={runSqlQuery} disabled={sqlLoading}>
                  {sqlLoading ? 'Running...' : 'Run Query'}
                </Button>
                {sqlTruncated ? <Badge variant="warning">Result truncated by payload limits</Badge> : null}
                {sqlError ? <p className="text-xs text-error">{sqlError}</p> : null}
              </div>
              {sqlColumns.length > 0 ? (
                <div className="overflow-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-secondary">
                      <tr>
                        {sqlColumns.map((col) => (
                          <th key={col} className="border-b border-border px-2 py-1.5 text-left font-medium text-content-secondary">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sqlResults.map((row, idx) => (
                        <tr key={idx} className="odd:bg-surface-primary even:bg-surface-elevated">
                          {sqlColumns.map((col) => (
                            <td key={`${idx}-${col}`} className="border-t border-border px-2 py-1.5 font-mono text-content-primary">
                              {row[col] == null ? 'null' : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
            <iframe src="http://localhost:4213" className="h-[560px] w-full border-none" title="DuckDB Explorer" />
          </Card>
        ) : null}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedObject ? `${selectedObject.table} Documentation` : 'Object Documentation'}
      >
        {selectedObject ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Overview</p>
              <p className="mt-1 font-mono text-sm text-content-primary">{selectedObject.id}</p>
              <p className="mt-1 text-sm text-content-secondary">{DOMAIN_META[selectedObject.domain].purpose}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Card className="p-3">
                <p className="text-xs text-content-tertiary">Type</p>
                <p className="mt-1 text-sm font-medium text-content-primary capitalize">{selectedObject.kind}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-content-tertiary">Columns</p>
                <p className="mt-1 text-sm font-medium text-content-primary">{selectedObject.columnCount}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-content-tertiary">Rows</p>
                <p className="mt-1 text-sm font-medium text-content-primary">{selectedObject.rowCount ?? 'n/a'}</p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-content-tertiary">Freshness</p>
                <p className="mt-1 text-sm font-medium text-content-primary">{formatDate(selectedObject.freshness)}</p>
              </Card>
            </div>

            <DocCompletenessMeter score={docScore} threshold={80} />
            <OwnershipPill owner="Analytics Engineering" steward="Domain Team" />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Draft AI Documentation</p>
              <Input readOnly value={`Object ${selectedObject.table} centralizes ${selectedObject.domain} data for reporting and AI workflows.`} />
            </div>
          </div>
        ) : (
          <EmptyState title="No object selected" description="Select an object from the explorer table to inspect details." />
        )}
      </Drawer>
    </AppShell>
  );
}
