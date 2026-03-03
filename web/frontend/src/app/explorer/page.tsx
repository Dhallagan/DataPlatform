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

type ExplorerTab = 'overview' | 'objects' | 'metrics' | 'lineage' | 'centralization' | 'sql';
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
    source?: string;
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

interface TableDetailPayload {
  success: boolean;
  table?: {
    table: string;
    table_schema: string;
    table_name: string;
    column_count: number;
    freshness_column?: string | null;
    freshest_at?: string | null;
    owner?: string | null;
    certified?: boolean;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
      ordinal_position: number;
      sensitivity_class?: string;
    }>;
  };
  detail?: string;
}

interface LineageLookupPayload {
  success: boolean;
  lineage?: {
    object: string;
    token: string;
    lineage: {
      bronze: string[];
      silver: string[];
      analytics: string[];
    };
    related_count: number;
    source?: string;
  };
  detail?: string;
}

interface MetricsCatalogPayload {
  success: boolean;
  catalog?: {
    source?: string;
    metric_count: number;
    metrics: Array<Record<string, unknown>>;
  };
  detail?: string;
}

interface MetadataSearchPayload {
  success: boolean;
  search?: {
    source: string;
    count: number;
    results: Array<{
      result_type: 'table' | 'metric';
      name: string;
      owner?: string | null;
      certified?: boolean;
      grain?: string | null;
      freshness_sla?: string | null;
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

interface ExplorerMetric {
  metricName: string;
  metricKey: string;
  owner: string;
  grain: string;
  freshnessSla: string;
  certified: boolean;
  source: string;
  definition: string;
  sqlDefinitionOrModel: string;
}

interface SearchMatch {
  resultType: 'table' | 'metric';
  name: string;
  owner?: string | null;
  certified?: boolean;
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
  { key: 'metrics', label: 'Metrics Catalog' },
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
  const [quickMatchIndex, setQuickMatchIndex] = useState(0);
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [schemaFilter, setSchemaFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'entity' | 'fact' | 'metric'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [sqlText, setSqlText] = useState('SELECT * FROM core.daily_kpis ORDER BY date DESC LIMIT 50');
  const [sqlResults, setSqlResults] = useState<Record<string, unknown>[]>([]);
  const [sqlColumns, setSqlColumns] = useState<string[]>([]);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlTruncated, setSqlTruncated] = useState(false);
  const [tableColumns, setTableColumns] = useState<Record<string, number>>({});
  const [tableMeta, setTableMeta] = useState<Record<string, { owner?: string; certified?: boolean }>>({});
  const [tablesCatalogSource, setTablesCatalogSource] = useState<string>('unknown');
  const [tablesCatalogGeneratedAt, setTablesCatalogGeneratedAt] = useState<string | null>(null);
  const [selectedTableDetail, setSelectedTableDetail] = useState<TableDetailPayload['table'] | null>(null);
  const [selectedTableLoading, setSelectedTableLoading] = useState(false);
  const [selectedTableError, setSelectedTableError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ExplorerMetric[]>([]);
  const [metricsSource, setMetricsSource] = useState<string>('unknown');
  const [metricsOnlyCertified, setMetricsOnlyCertified] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState<string>('');
  const [objectSortKey, setObjectSortKey] = useState<'id' | 'schema' | 'owner' | 'columnCount' | 'freshness'>('id');
  const [objectSortDir, setObjectSortDir] = useState<'asc' | 'desc'>('asc');
  const [objectPageSize, setObjectPageSize] = useState(25);
  const [objectPage, setObjectPage] = useState(1);
  const [metricSortKey, setMetricSortKey] = useState<'metricName' | 'owner' | 'grain' | 'freshnessSla' | 'certified'>('metricName');
  const [metricSortDir, setMetricSortDir] = useState<'asc' | 'desc'>('asc');
  const [metricPageSize, setMetricPageSize] = useState(20);
  const [metricPage, setMetricPage] = useState(1);
  const [catalogSearchMatches, setCatalogSearchMatches] = useState<SearchMatch[]>([]);
  const [catalogSearchSource, setCatalogSearchSource] = useState<string>('none');
  const [lineageLookupValue, setLineageLookupValue] = useState('metric_spine');
  const [lineageLookupResult, setLineageLookupResult] = useState<LineageLookupPayload['lineage'] | null>(null);
  const [lineageLookupLoading, setLineageLookupLoading] = useState(false);
  const [lineageLookupError, setLineageLookupError] = useState<string | null>(null);
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
        const metricsResponse = await fetch('/api/metadata/metrics');

        const payload = (await tablesResponse.json()) as TablesCatalogPayload;
        if (!tablesResponse.ok || !payload.success || !payload.catalog) {
          throw new Error(payload.detail || 'Failed to load warehouse metadata');
        }
        const metricsPayload = (await metricsResponse.json()) as MetricsCatalogPayload;

        const next: Record<string, number> = {};
        const nextMeta: Record<string, { owner?: string; certified?: boolean }> = {};
        for (const table of payload.catalog.tables) {
          next[table.table] = Number(table.column_count || 0);
          nextMeta[table.table] = {
            owner: table.owner,
            certified: table.certified,
          };
        }

        const normalizedMetrics: ExplorerMetric[] = [];
        if (metricsResponse.ok && metricsPayload.success && metricsPayload.catalog) {
          for (const item of metricsPayload.catalog.metrics) {
            const metricName = String(item.metric_name || item.metric_object || '');
            if (!metricName) continue;
            normalizedMetrics.push({
              metricName,
              metricKey: String(item.metric_key || metricName),
              owner: String(item.owner || 'Unknown'),
              grain: String(item.grain || 'n/a'),
              freshnessSla: String(item.freshness_sla || 'n/a'),
              certified: Boolean(item.certified),
              source: String(item.source || metricsPayload.catalog.source || 'unknown'),
              definition: String(item.business_definition || ''),
              sqlDefinitionOrModel: String(item.sql_definition_or_model || item.metric_object || ''),
            });
          }
        }

        setTableColumns(next);
        setTableMeta(nextMeta);
        setTablesCatalogSource(payload.catalog.source || 'unknown');
        setTablesCatalogGeneratedAt(payload.catalog.generated_at || null);
        setMetrics(normalizedMetrics);
        setMetricsSource(metricsPayload.catalog?.source || 'unknown');
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
      if (ownerFilter !== 'all' && (object.owner || 'Unknown') !== ownerFilter) return false;
      if (certifiedOnly && !object.certified) return false;
      if (!term) return true;
      return object.id.toLowerCase().includes(term) || object.kind.toLowerCase().includes(term);
    });
  }, [activeDomain, objects, search, schemaFilter, typeFilter, ownerFilter, certifiedOnly]);

  const availableSchemas = useMemo(() => {
    const schemas = new Set(
      objects
        .filter((object) => object.domain === activeDomain)
        .map((object) => object.schema),
    );
    return ['all', ...Array.from(schemas).sort()];
  }, [activeDomain, objects]);

  const availableOwners = useMemo(() => {
    const owners = new Set(
      objects
        .filter((object) => object.domain === activeDomain)
        .map((object) => object.owner || 'Unknown'),
    );
    return ['all', ...Array.from(owners).sort()];
  }, [activeDomain, objects]);

  const globalSearchMatches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    if (catalogSearchMatches.length > 0) return catalogSearchMatches;
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
      .slice(0, 8)
      .map((object) => ({
        resultType: 'table' as const,
        name: object.id,
        owner: object.owner,
        certified: object.certified,
      }));
  }, [objects, search, catalogSearchMatches]);

  const filteredMetrics = useMemo(() => {
    const term = search.trim().toLowerCase();
    return metrics.filter((metric) => {
      if (metricsOnlyCertified && !metric.certified) return false;
      if (!term) return true;
      return (
        metric.metricName.toLowerCase().includes(term) ||
        metric.metricKey.toLowerCase().includes(term) ||
        metric.owner.toLowerCase().includes(term) ||
        metric.grain.toLowerCase().includes(term) ||
        metric.definition.toLowerCase().includes(term)
      );
    });
  }, [metrics, metricsOnlyCertified, search]);

  const sortedObjects = useMemo(() => {
    const rows = [...filteredObjects];
    rows.sort((a, b) => {
      let left: string | number = '';
      let right: string | number = '';
      if (objectSortKey === 'columnCount') {
        left = a.columnCount;
        right = b.columnCount;
      } else if (objectSortKey === 'freshness') {
        left = a.freshness ? new Date(a.freshness).getTime() : 0;
        right = b.freshness ? new Date(b.freshness).getTime() : 0;
      } else if (objectSortKey === 'owner') {
        left = (a.owner || 'Unknown').toLowerCase();
        right = (b.owner || 'Unknown').toLowerCase();
      } else if (objectSortKey === 'schema') {
        left = a.schema.toLowerCase();
        right = b.schema.toLowerCase();
      } else {
        left = a.id.toLowerCase();
        right = b.id.toLowerCase();
      }
      if (left < right) return objectSortDir === 'asc' ? -1 : 1;
      if (left > right) return objectSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filteredObjects, objectSortKey, objectSortDir]);

  const objectTotalPages = useMemo(() => Math.max(1, Math.ceil(sortedObjects.length / objectPageSize)), [sortedObjects.length, objectPageSize]);

  const pagedObjects = useMemo(() => {
    const start = (objectPage - 1) * objectPageSize;
    return sortedObjects.slice(start, start + objectPageSize);
  }, [sortedObjects, objectPage, objectPageSize]);

  const sortedMetrics = useMemo(() => {
    const rows = [...filteredMetrics];
    rows.sort((a, b) => {
      let left: string | number = '';
      let right: string | number = '';
      if (metricSortKey === 'certified') {
        left = a.certified ? 1 : 0;
        right = b.certified ? 1 : 0;
      } else if (metricSortKey === 'owner') {
        left = a.owner.toLowerCase();
        right = b.owner.toLowerCase();
      } else if (metricSortKey === 'grain') {
        left = a.grain.toLowerCase();
        right = b.grain.toLowerCase();
      } else if (metricSortKey === 'freshnessSla') {
        left = a.freshnessSla.toLowerCase();
        right = b.freshnessSla.toLowerCase();
      } else {
        left = a.metricName.toLowerCase();
        right = b.metricName.toLowerCase();
      }
      if (left < right) return metricSortDir === 'asc' ? -1 : 1;
      if (left > right) return metricSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filteredMetrics, metricSortKey, metricSortDir]);

  const metricTotalPages = useMemo(() => Math.max(1, Math.ceil(sortedMetrics.length / metricPageSize)), [sortedMetrics.length, metricPageSize]);

  const pagedMetrics = useMemo(() => {
    const start = (metricPage - 1) * metricPageSize;
    return sortedMetrics.slice(start, start + metricPageSize);
  }, [sortedMetrics, metricPage, metricPageSize]);

  useEffect(() => {
    setObjectPage(1);
  }, [search, activeDomain, schemaFilter, typeFilter, ownerFilter, certifiedOnly, objectPageSize, objectSortKey, objectSortDir]);

  useEffect(() => {
    setMetricPage(1);
  }, [search, metricsOnlyCertified, metricPageSize, metricSortKey, metricSortDir]);

  useEffect(() => {
    if (objectPage > objectTotalPages) setObjectPage(objectTotalPages);
  }, [objectPage, objectTotalPages]);

  useEffect(() => {
    if (metricPage > metricTotalPages) setMetricPage(metricTotalPages);
  }, [metricPage, metricTotalPages]);

  const selectedMetric = useMemo(() => {
    if (!filteredMetrics.length) return null;
    if (!selectedMetricKey) return filteredMetrics[0];
    return filteredMetrics.find((metric) => metric.metricKey === selectedMetricKey) || filteredMetrics[0];
  }, [filteredMetrics, selectedMetricKey]);

  useEffect(() => {
    if (globalSearchMatches.length === 0) {
      setQuickMatchIndex(0);
      return;
    }
    if (quickMatchIndex >= globalSearchMatches.length) {
      setQuickMatchIndex(0);
    }
  }, [globalSearchMatches, quickMatchIndex]);

  function openObjectFromSearch(object: WarehouseObject) {
    setActiveTab('objects');
    setActiveDomain(object.domain);
    setSelectedObjectId(object.id);
    setDrawerOpen(true);
  }

  function openSearchMatch(match: SearchMatch) {
    if (match.resultType === 'metric') {
      setActiveTab('metrics');
      setSelectedMetricKey(match.name);
      return;
    }
    const object = objects.find((item) => item.id === match.name);
    if (object) {
      openObjectFromSearch(object);
    } else {
      setSearch(match.name);
      setActiveTab('objects');
    }
  }

  useEffect(() => {
    if (!selectedObjectId && filteredObjects.length > 0) {
      setSelectedObjectId(filteredObjects[0].id);
    }
  }, [filteredObjects, selectedObjectId]);

  const selectedObject = useMemo(
    () => filteredObjects.find((object) => object.id === selectedObjectId) || null,
    [filteredObjects, selectedObjectId],
  );

  useEffect(() => {
    async function loadSelectedTableDetail(tableRef: string) {
      setSelectedTableLoading(true);
      setSelectedTableError(null);
      try {
        const response = await fetch(`/api/metadata/tables/${encodeURIComponent(tableRef)}`);
        const payload = (await response.json()) as TableDetailPayload;
        if (!response.ok || !payload.success || !payload.table) {
          throw new Error(payload.detail || 'Failed to load table metadata');
        }
        setSelectedTableDetail(payload.table);
      } catch (err) {
        setSelectedTableDetail(null);
        setSelectedTableError(err instanceof Error ? err.message : 'Failed to load table metadata');
      } finally {
        setSelectedTableLoading(false);
      }
    }

    if (!drawerOpen || !selectedObject?.id) return;
    loadSelectedTableDetail(selectedObject.id);
  }, [drawerOpen, selectedObject?.id]);

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
    const term = search.trim();
    if (!term) {
      setCatalogSearchMatches([]);
      setCatalogSearchSource('none');
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/metadata/search?q=${encodeURIComponent(term)}&limit=8`);
        const payload = (await response.json()) as MetadataSearchPayload;
        if (!response.ok || !payload.success || !payload.search) return;
        if (cancelled) return;
        setCatalogSearchSource(payload.search.source || 'unknown');
        setCatalogSearchMatches(
          payload.search.results.map((row) => ({
            resultType: row.result_type,
            name: row.name,
            owner: row.owner,
            certified: row.certified,
          })),
        );
      } catch {
        if (!cancelled) {
          setCatalogSearchMatches([]);
          setCatalogSearchSource('client');
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search]);

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
      const typingInTextArea = target instanceof HTMLTextAreaElement;
      const hasQuickMatches = search.trim().length > 0 && globalSearchMatches.length > 0;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focusSearchInput();
        return;
      }

      if (!typingInField && event.key === '/') {
        event.preventDefault();
        focusSearchInput();
        return;
      }

      if (typingInTextArea) return;

      if (hasQuickMatches && event.key === 'ArrowDown') {
        event.preventDefault();
        setQuickMatchIndex((prev) => (prev + 1) % globalSearchMatches.length);
        return;
      }

      if (hasQuickMatches && event.key === 'ArrowUp') {
        event.preventDefault();
        setQuickMatchIndex((prev) => (prev - 1 + globalSearchMatches.length) % globalSearchMatches.length);
        return;
      }

      if (hasQuickMatches && event.key === 'Enter') {
        event.preventDefault();
        const selected = globalSearchMatches[quickMatchIndex] || globalSearchMatches[0];
        if (selected) openSearchMatch(selected);
        return;
      }

      if (event.key === 'Escape') {
        setSearch('');
        setQuickMatchIndex(0);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [globalSearchMatches, quickMatchIndex, search, objects]);

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

  async function lookupLineage(objectName: string) {
    const cleaned = objectName.trim();
    if (!cleaned) return;
    setLineageLookupLoading(true);
    setLineageLookupError(null);
    try {
      const response = await fetch(`/api/metadata/lineage/${encodeURIComponent(cleaned)}`);
      const payload = (await response.json()) as LineageLookupPayload;
      if (!response.ok || !payload.success || !payload.lineage) {
        throw new Error(payload.detail || 'Failed to fetch lineage');
      }
      setLineageLookupResult(payload.lineage);
    } catch (err) {
      setLineageLookupResult(null);
      setLineageLookupError(err instanceof Error ? err.message : 'Failed to fetch lineage');
    } finally {
      setLineageLookupLoading(false);
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
        <Card variant="elevated" className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-content-tertiary">Quick Find</p>
              <p className="text-sm text-content-primary">
                Type to search tables/metrics. Use <span className="font-mono">Cmd/Ctrl + K</span> or <span className="font-mono">/</span> to jump to search.
              </p>
              <p className="text-[11px] text-content-tertiary">
                Catalog source: <span className="font-mono">{tablesCatalogSource}</span>
                {tablesCatalogGeneratedAt ? ` • updated ${formatDate(tablesCatalogGeneratedAt)}` : ''}
              </p>
            </div>
            <Badge variant="accent">{allTables.length} catalog objects</Badge>
          </div>
        </Card>
        {tablesCatalogSource !== 'core.table_catalog' ? (
          <Card variant="default" className="p-3 border-warning/40 bg-warning/5">
            <p className="text-xs text-warning">
              Explorer is using fallback metadata source (<span className="font-mono">{tablesCatalogSource}</span>).
              Run <span className="font-mono">./pipeline/run_catalog_refresh.sh</span> to restore central catalog mode.
            </p>
          </Card>
        ) : null}
        {search.trim() ? (
          <Card variant="default" className="p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-content-tertiary">Quick matches for “{search.trim()}”</p>
              <div className="flex items-center gap-1.5">
                <Badge variant="neutral">{globalSearchMatches.length}</Badge>
                <Badge variant="neutral">{catalogSearchSource}</Badge>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-content-tertiary">
              Navigate with <span className="font-mono">↑/↓</span>, open with <span className="font-mono">Enter</span>, clear with <span className="font-mono">Esc</span>.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {globalSearchMatches.length === 0 ? (
                <p className="text-sm text-content-secondary">No objects match this search.</p>
              ) : (
                globalSearchMatches.map((object, index) => (
                  <Button
                    key={`${object.resultType}:${object.name}`}
                    variant={index === quickMatchIndex ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => openSearchMatch(object)}
                  >
                    {object.resultType === 'metric' ? 'metric: ' : 'table: '}
                    {object.name}
                  </Button>
                ))
              )}
            </div>
          </Card>
        ) : null}

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Warehouse Objects" value={`${allTables.length}`} delta={`Source: ${tablesCatalogSource}`} trend="neutral" />
          <StatTile label="Schemas" value={`${overview?.schema_summary.table_count ? Object.keys(overview.by_schema).length : 0}`} delta={`${overview?.schema_summary.column_count || 0} tracked columns`} trend="neutral" />
          <StatTile label="Metrics" value={`${metrics.length}`} delta={`Source: ${metricsSource}`} trend="neutral" />
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
                <div className="rounded border border-accent/40 bg-accent/5 p-2">
                  <p className="text-xs font-medium text-content-primary">Object Filters</p>
                  <p className="text-[11px] text-content-secondary">
                    Narrow the central catalog by schema, object type, and certification state.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={schemaFilter}
                    onChange={(event) => setSchemaFilter(event.target.value)}
                    className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                    aria-label="Filter by schema"
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
                    aria-label="Filter by object type"
                  >
                    <option value="all">All types</option>
                    <option value="entity">Entity</option>
                    <option value="fact">Fact</option>
                    <option value="metric">Metric</option>
                  </select>
                  <select
                    value={ownerFilter}
                    onChange={(event) => setOwnerFilter(event.target.value)}
                    className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                    aria-label="Filter by owner"
                  >
                    {availableOwners.map((owner) => (
                      <option key={owner} value={owner}>
                        {owner === 'all' ? 'All owners' : owner}
                      </option>
                    ))}
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
                      setOwnerFilter('all');
                      setCertifiedOnly(false);
                    }}
                  >
                    Reset
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
                  <select
                    value={objectSortKey}
                    onChange={(event) => setObjectSortKey(event.target.value as 'id' | 'schema' | 'owner' | 'columnCount' | 'freshness')}
                    className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                  >
                    <option value="id">Sort: Object</option>
                    <option value="schema">Sort: Schema</option>
                    <option value="owner">Sort: Owner</option>
                    <option value="columnCount">Sort: Column Count</option>
                    <option value="freshness">Sort: Freshness</option>
                  </select>
                  <select
                    value={objectSortDir}
                    onChange={(event) => setObjectSortDir(event.target.value as 'asc' | 'desc')}
                    className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                  >
                    <option value="asc">Asc</option>
                    <option value="desc">Desc</option>
                  </select>
                  <select
                    value={objectPageSize}
                    onChange={(event) => setObjectPageSize(Number(event.target.value))}
                    className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                  <div className="ml-auto flex items-center gap-2 text-xs text-content-tertiary">
                    <Button size="sm" variant="ghost" disabled={objectPage <= 1} onClick={() => setObjectPage((p) => Math.max(1, p - 1))}>
                      Prev
                    </Button>
                    <span>Page {objectPage} / {objectTotalPages}</span>
                    <Button size="sm" variant="ghost" disabled={objectPage >= objectTotalPages} onClick={() => setObjectPage((p) => Math.min(objectTotalPages, p + 1))}>
                      Next
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <DataTable<WarehouseObject>
                  columns={[
                    { key: 'id', header: 'Object' },
                    { key: 'schema', header: 'Schema' },
                    { key: 'kind', header: 'Type' },
                    { key: 'owner', header: 'Owner' },
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
                  rows={pagedObjects}
                  emptyLabel="No objects found for this domain and search."
                />
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'metrics' ? (
          <Card variant="elevated" className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-content-primary">Metrics Catalog</h2>
                <p className="mt-1 text-sm text-content-secondary">
                  Central metric registry for humans and agents. Source: {metricsSource}
                </p>
              </div>
              <label className="flex items-center gap-1.5 rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary">
                <input
                  type="checkbox"
                  checked={metricsOnlyCertified}
                  onChange={(event) => setMetricsOnlyCertified(event.target.checked)}
                  className="h-3 w-3"
                />
                Certified only
              </label>
            </div>
            <div className="mt-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <select
                  value={metricSortKey}
                  onChange={(event) => setMetricSortKey(event.target.value as 'metricName' | 'owner' | 'grain' | 'freshnessSla' | 'certified')}
                  className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                >
                  <option value="metricName">Sort: Metric</option>
                  <option value="owner">Sort: Owner</option>
                  <option value="grain">Sort: Grain</option>
                  <option value="freshnessSla">Sort: SLA</option>
                  <option value="certified">Sort: Certified</option>
                </select>
                <select
                  value={metricSortDir}
                  onChange={(event) => setMetricSortDir(event.target.value as 'asc' | 'desc')}
                  className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
                <select
                  value={metricPageSize}
                  onChange={(event) => setMetricPageSize(Number(event.target.value))}
                  className="rounded border border-border bg-surface-primary px-2 py-1.5 text-xs text-content-primary"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
                <div className="ml-auto flex items-center gap-2 text-xs text-content-tertiary">
                  <Button size="sm" variant="ghost" disabled={metricPage <= 1} onClick={() => setMetricPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </Button>
                  <span>Page {metricPage} / {metricTotalPages}</span>
                  <Button size="sm" variant="ghost" disabled={metricPage >= metricTotalPages} onClick={() => setMetricPage((p) => Math.min(metricTotalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
              <DataTable<ExplorerMetric>
                columns={[
                  { key: 'metricName', header: 'Metric' },
                  { key: 'owner', header: 'Owner' },
                  { key: 'grain', header: 'Grain' },
                  { key: 'freshnessSla', header: 'SLA' },
                  {
                    key: 'certified',
                    header: 'Certified',
                    render: (row: ExplorerMetric) => (
                      <Badge variant={row.certified ? 'success' : 'neutral'}>
                        {row.certified ? 'Yes' : 'No'}
                      </Badge>
                    ),
                  },
                  { key: 'source', header: 'Source' },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (row: ExplorerMetric) => (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedMetricKey(row.metricKey)}
                      >
                        Inspect
                      </Button>
                    ),
                  },
                ]}
                rows={pagedMetrics}
                emptyLabel="No metrics match the current search/filter."
              />
            </div>
            {selectedMetric ? (
              <div className="mt-3 rounded border border-border bg-surface-primary p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-content-tertiary">Metric Detail</p>
                    <p className="text-sm font-semibold text-content-primary">{selectedMetric.metricName}</p>
                    <p className="text-xs font-mono text-content-tertiary">{selectedMetric.metricKey}</p>
                  </div>
                  <Badge variant={selectedMetric.certified ? 'success' : 'neutral'}>
                    {selectedMetric.certified ? 'Certified' : 'Uncertified'}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-content-secondary">
                  {selectedMetric.definition || 'No definition available yet.'}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-4">
                  <div className="rounded border border-border px-2 py-1.5">
                    <span className="text-content-tertiary">Owner:</span> {selectedMetric.owner}
                  </div>
                  <div className="rounded border border-border px-2 py-1.5">
                    <span className="text-content-tertiary">Grain:</span> {selectedMetric.grain}
                  </div>
                  <div className="rounded border border-border px-2 py-1.5">
                    <span className="text-content-tertiary">SLA:</span> {selectedMetric.freshnessSla}
                  </div>
                  <div className="rounded border border-border px-2 py-1.5">
                    <span className="text-content-tertiary">Source:</span> {selectedMetric.source}
                  </div>
                </div>
                <p className="mt-2 text-xs text-content-tertiary">
                  SQL/Model reference: <span className="font-mono text-content-primary">{selectedMetric.sqlDefinitionOrModel || 'n/a'}</span>
                </p>
              </div>
            ) : null}
          </Card>
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
            <div className="mt-3 rounded border border-border bg-surface-primary p-3">
              <p className="text-xs uppercase tracking-wide text-content-tertiary">Lineage Lookup</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  value={lineageLookupValue}
                  onChange={(event) => setLineageLookupValue(event.target.value)}
                  placeholder="Enter object name (e.g. metric_spine, mrr, growth_daily)"
                  className="min-w-[320px]"
                />
                <Button onClick={() => lookupLineage(lineageLookupValue)} disabled={lineageLookupLoading}>
                  {lineageLookupLoading ? 'Looking up...' : 'Lookup'}
                </Button>
              </div>
              {lineageLookupError ? <p className="mt-2 text-xs text-error">{lineageLookupError}</p> : null}
              {lineageLookupResult ? (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded border border-border p-2">
                    <p className="text-xs text-content-tertiary">Bronze</p>
                    <p className="mt-1 text-xs text-content-primary font-mono">
                      {lineageLookupResult.lineage.bronze.length > 0 ? lineageLookupResult.lineage.bronze.join(', ') : 'none'}
                    </p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="text-xs text-content-tertiary">Silver</p>
                    <p className="mt-1 text-xs text-content-primary font-mono">
                      {lineageLookupResult.lineage.silver.length > 0 ? lineageLookupResult.lineage.silver.join(', ') : 'none'}
                    </p>
                  </div>
                  <div className="rounded border border-border p-2">
                    <p className="text-xs text-content-tertiary">Analytics</p>
                    <p className="mt-1 text-xs text-content-primary font-mono">
                      {lineageLookupResult.lineage.analytics.length > 0 ? lineageLookupResult.lineage.analytics.join(', ') : 'none'}
                    </p>
                  </div>
                </div>
              ) : null}
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
                {sqlColumns.length > 0 ? (
                  <Badge variant="neutral">
                    {sqlResults.length} rows x {sqlColumns.length} cols
                  </Badge>
                ) : null}
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
            <OwnershipPill owner={selectedTableDetail?.owner || selectedObject.owner || 'Analytics Engineering'} steward="Domain Team" />

            <div className="rounded border border-border bg-surface-primary p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Catalog Metadata</p>
              {selectedTableLoading ? (
                <p className="mt-2 text-xs text-content-secondary">Loading table metadata...</p>
              ) : selectedTableError ? (
                <p className="mt-2 text-xs text-error">{selectedTableError}</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={selectedTableDetail?.certified ? 'success' : 'neutral'}>
                      {selectedTableDetail?.certified ? 'Certified' : 'Uncertified'}
                    </Badge>
                    <Badge variant="neutral">
                      {selectedTableDetail?.column_count ?? selectedObject.columnCount} columns
                    </Badge>
                    <Badge variant="neutral">
                      Freshness column: {selectedTableDetail?.freshness_column || 'n/a'}
                    </Badge>
                  </div>
                  <div className="max-h-56 overflow-auto rounded border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-secondary">
                        <tr>
                          <th className="border-b border-border px-2 py-1.5 text-left text-content-tertiary">Column</th>
                          <th className="border-b border-border px-2 py-1.5 text-left text-content-tertiary">Type</th>
                          <th className="border-b border-border px-2 py-1.5 text-left text-content-tertiary">Nullable</th>
                          <th className="border-b border-border px-2 py-1.5 text-left text-content-tertiary">Sensitivity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedTableDetail?.columns || []).slice(0, 40).map((column) => (
                          <tr key={column.name} className="odd:bg-surface-primary even:bg-surface-elevated">
                            <td className="border-t border-border px-2 py-1.5 font-mono text-content-primary">{column.name}</td>
                            <td className="border-t border-border px-2 py-1.5 text-content-secondary">{column.type}</td>
                            <td className="border-t border-border px-2 py-1.5 text-content-secondary">{column.nullable ? 'yes' : 'no'}</td>
                            <td className="border-t border-border px-2 py-1.5 text-content-secondary">{column.sensitivity_class || 'standard'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

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
