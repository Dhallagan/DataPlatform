'use client';

import { useEffect, useMemo, useState } from 'react';
import Toolbar from '@/components/Toolbar';

type ViewTab = 'domain_map' | 'object_graph' | 'lineage_explorer';
type DomainId = 'customer' | 'runtime' | 'commercial' | 'growth' | 'ops';

interface MetadataTablesPayload {
  success: boolean;
  catalog?: {
    tables: Array<{
      table: string;
      table_schema: string;
      table_name: string;
      column_count: number;
    }>;
  };
  error?: string;
}

interface DomainCard {
  id: DomainId;
  name: string;
  purpose: string;
  owns: string[];
  kpis: string[];
  signals: string[];
  tableCount: number;
}

interface ObjectNode {
  id: string;
  domain: DomainId;
  label: string;
  sourceModel: string;
  columnCount: number;
  kind: 'entity' | 'fact' | 'metric';
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

const VIEW_TABS: Array<{ id: ViewTab; label: string; description: string }> = [
  {
    id: 'domain_map',
    label: 'Domain Map',
    description: 'Business architecture view for Growth, Finance, Product, and Ops.',
  },
  {
    id: 'object_graph',
    label: 'Object Graph',
    description: 'Explore warehouse objects by domain with live table metadata.',
  },
  {
    id: 'lineage_explorer',
    label: 'Lineage Explorer',
    description: 'Trace key business objects from source to metrics and signals.',
  },
];

const DOMAIN_ORDER: DomainId[] = ['customer', 'runtime', 'commercial', 'growth', 'ops'];

function toDomainLabel(domain: DomainId): string {
  if (domain === 'customer') return 'Customer Domain';
  if (domain === 'runtime') return 'Runtime Domain';
  if (domain === 'commercial') return 'Commercial Domain';
  if (domain === 'growth') return 'Growth Domain';
  return 'Ops Domain';
}

function toDomainPurpose(domain: DomainId): string {
  if (domain === 'customer') return 'Account and user identity model for lifecycle ownership.';
  if (domain === 'runtime') return 'Core BrowserBase session and event execution model.';
  if (domain === 'commercial') return 'Revenue lifecycle across plan, subscription, usage, and invoice.';
  if (domain === 'growth') return 'GTM funnel, conversion workflows, and lead/opportunity intelligence.';
  return 'Reliability, performance, and cost operations tied to business impact.';
}

function classifyDomain(fullName: string): DomainId {
  const lower = fullName.toLowerCase();
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

function kindFromName(name: string): 'entity' | 'fact' | 'metric' {
  const lower = name.toLowerCase();
  if (lower.includes('v_') || lower.includes('kpi') || lower.includes('metric') || lower.includes('signal')) {
    return 'metric';
  }
  if (lower.includes('fct') || lower.includes('daily') || lower.includes('snapshot') || lower.includes('queue')) {
    return 'fact';
  }
  return 'entity';
}

function badgeClasses(kind: ObjectNode['kind']): string {
  if (kind === 'entity') return 'bg-cyan-500/10 text-cyan-700';
  if (kind === 'fact') return 'bg-amber-500/10 text-amber-700';
  return 'bg-rose-500/10 text-rose-700';
}

function toDomainAccent(domain: DomainId): string {
  if (domain === 'customer') return 'border-cyan-300';
  if (domain === 'runtime') return 'border-amber-300';
  if (domain === 'commercial') return 'border-emerald-300';
  if (domain === 'growth') return 'border-indigo-300';
  return 'border-rose-300';
}

function pickTable(tables: string[], include: string[], schemaHint?: string): string {
  const matches = tables.filter((table) => {
    const lower = table.toLowerCase();
    if (schemaHint && !lower.startsWith(`${schemaHint.toLowerCase()}.`)) return false;
    return include.every((token) => lower.includes(token));
  });
  return matches[0] || 'n/a';
}

export default function OntologyPage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('domain_map');
  const [activeDomain, setActiveDomain] = useState<DomainId>('growth');
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadMetadata() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/metadata/tables');
        const payload = (await response.json()) as MetadataTablesPayload;
        if (!response.ok || !payload.success || !payload.catalog) {
          throw new Error(payload.error || 'Failed to load metadata catalog');
        }

        const next: Record<string, number> = {};
        for (const row of payload.catalog.tables) {
          next[row.table] = Number(row.column_count || 0);
        }
        setTableColumns(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load metadata');
      } finally {
        setIsLoading(false);
      }
    }

    loadMetadata();
  }, []);

  const allTables = useMemo(() => Object.keys(tableColumns), [tableColumns]);

  const domainCards = useMemo<DomainCard[]>(() => {
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

    return DOMAIN_ORDER.map((domain) => {
      const tables = byDomain[domain].sort();
      const kpis = tables
        .filter((table) => /kpi|metric|mrr|revenue|daily_kpis|snapshot/i.test(table))
        .slice(0, 5)
        .map((table) => table.split('.').pop() || table);
      const signals = tables
        .filter((table) => /signal|risk|task|action|queue/i.test(table))
        .slice(0, 5)
        .map((table) => table.split('.').pop() || table);

      return {
        id: domain,
        name: toDomainLabel(domain),
        purpose: toDomainPurpose(domain),
        owns: tables.slice(0, 8).map((table) => table.split('.').pop() || table),
        kpis,
        signals,
        tableCount: tables.length,
      };
    });
  }, [allTables]);

  const domainObjects = useMemo<ObjectNode[]>(() => {
    return allTables
      .filter((table) => classifyDomain(table) === activeDomain)
      .filter((table) => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return table.toLowerCase().includes(term) || kindFromName(table).toLowerCase().includes(term);
      })
      .sort()
      .map((table) => ({
        id: table,
        domain: activeDomain,
        label: table.split('.').pop() || table,
        sourceModel: table,
        columnCount: tableColumns[table] || 0,
        kind: kindFromName(table),
      }));
  }, [allTables, activeDomain, tableColumns]);

  useEffect(() => {
    if (!selectedObjectId && domainObjects.length > 0) {
      setSelectedObjectId(domainObjects[0].id);
      return;
    }
    if (selectedObjectId && !domainObjects.find((object) => object.id === selectedObjectId) && domainObjects.length > 0) {
      setSelectedObjectId(domainObjects[0].id);
    }
  }, [domainObjects, selectedObjectId]);

  const selectedObject = useMemo(
    () => domainObjects.find((object) => object.id === selectedObjectId) || null,
    [domainObjects, selectedObjectId]
  );

  const lineageRows = useMemo<LineageRow[]>(() => {
    return [
      {
        businessObject: 'Trial Conversion Risk',
        source: 'public.organizations, public.browser_sessions',
        bronze: pickTable(allTables, ['bronze_supabase', 'organizations']),
        silver: pickTable(allTables, ['silver', 'fct', 'run']) !== 'n/a' ? pickTable(allTables, ['silver', 'fct', 'run']) : pickTable(allTables, ['silver', 'sessions']),
        analytics: pickTable(allTables, ['growth', 'daily']),
        metric: pickTable(allTables, ['growth', 'kpi']),
        signal: pickTable(allTables, ['signal', 'trial', 'risk']),
      },
      {
        businessObject: 'GTM Pipeline Health',
        source: 'gtm.accounts, gtm.opportunities, gtm.leads',
        bronze: pickTable(allTables, ['bronze_supabase', 'gtm_opportunit']),
        silver: pickTable(allTables, ['stg_gtm_opportunit']),
        analytics: pickTable(allTables, ['gtm_pipeline']),
        metric: pickTable(allTables, ['gtm_funnel']),
        signal: pickTable(allTables, ['growth_task_queue']),
      },
      {
        businessObject: 'Recurring Revenue',
        source: 'public.subscriptions, public.invoices, public.plans',
        bronze: pickTable(allTables, ['bronze_supabase', 'subscriptions']),
        silver: pickTable(allTables, ['silver', 'fct', 'subscription']),
        analytics: pickTable(allTables, ['monthly_revenue']),
        metric: pickTable(allTables, ['mrr']),
        signal: pickTable(allTables, ['dunning']),
      },
      {
        businessObject: 'Run Quality',
        source: 'public.browser_sessions, public.session_events',
        bronze: pickTable(allTables, ['bronze_supabase', 'browser_sessions']),
        silver: pickTable(allTables, ['silver', 'fct', 'event']),
        analytics: pickTable(allTables, ['engineering_daily']),
        metric: pickTable(allTables, ['engineering_kpis']),
        signal: pickTable(allTables, ['signal', 'run']) !== 'n/a' ? pickTable(allTables, ['signal', 'run']) : pickTable(allTables, ['incident', 'exposure']),
      },
    ];
  }, [allTables]);

  const filteredLineage = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return lineageRows;
    return lineageRows.filter((row) =>
      Object.values(row).join(' ').toLowerCase().includes(term)
    );
  }, [lineageRows, searchTerm]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-secondary">
        <Toolbar />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <section className="bg-surface-elevated border border-border rounded-lg p-5 text-sm text-content-tertiary">
            Loading ontology metadata...
          </section>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-secondary">
        <Toolbar />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <section className="bg-red-500/10 border border-red-500/30 rounded-lg p-5 text-sm text-red-700">{error}</section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-5">
        <section className="bg-surface-elevated border border-border rounded-lg p-5">
          <h1 className="text-xl font-semibold text-content-primary">BrowserBase Ontology</h1>
          <p className="text-sm text-content-secondary mt-1">
            Live ontology generated from current warehouse tables and growth workflow models.
          </p>
        </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-2">
          <div className="flex flex-wrap gap-2">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface-primary text-content-secondary border-border hover:text-content-primary hover:bg-surface-tertiary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Type to filter ontology objects and lineage..."
              className="w-full md:w-[460px] px-3 py-2 rounded border border-border bg-surface-primary text-sm text-content-primary placeholder:text-content-tertiary"
            />
          </div>
          <p className="text-xs text-content-tertiary px-1 pt-2">
            {VIEW_TABS.find((tab) => tab.id === activeTab)?.description}
          </p>
        </section>

        {activeTab === 'domain_map' && (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {domainCards.map((domain) => (
              <article key={domain.id} className={`bg-surface-elevated border rounded-lg p-4 ${toDomainAccent(domain.id)}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-content-primary">{domain.name}</h2>
                  <span className="text-xs bg-surface-tertiary text-content-primary px-2 py-1 rounded">{domain.tableCount} tables</span>
                </div>
                <p className="text-sm text-content-secondary mt-1">{domain.purpose}</p>

                <div className="mt-3">
                  <p className="text-xs text-content-tertiary">Representative Objects</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {domain.owns.map((item) => (
                      <span key={item} className="font-mono text-[11px] bg-surface-tertiary px-2 py-1 rounded text-content-primary">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 text-xs space-y-2">
                  <div>
                    <p className="text-content-tertiary">KPIs</p>
                    <p className="text-content-primary">{domain.kpis.length > 0 ? domain.kpis.join(', ') : 'No KPI tables detected'}</p>
                  </div>
                  <div>
                    <p className="text-content-tertiary">Signals</p>
                    <p className="text-content-primary">{domain.signals.length > 0 ? domain.signals.join(', ') : 'No signal tables detected'}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {activeTab === 'object_graph' && (
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-3 bg-surface-elevated border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-content-primary mb-3">Domains</h2>
              <div className="space-y-2">
                {domainCards.map((domain) => (
                  <button
                    key={domain.id}
                    onClick={() => setActiveDomain(domain.id)}
                    className={`w-full text-left p-2 rounded border text-sm transition-colors ${
                      activeDomain === domain.id
                        ? 'bg-surface-tertiary border-accent text-content-primary'
                        : 'bg-surface-primary border-border text-content-secondary hover:text-content-primary'
                    }`}
                  >
                    {domain.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="xl:col-span-5 bg-surface-elevated border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-content-primary mb-3">{toDomainLabel(activeDomain)} Objects</h2>
              <div className="space-y-2 max-h-[640px] overflow-auto pr-1">
                {domainObjects.length === 0 ? (
                  <p className="text-sm text-content-tertiary">No objects match this filter.</p>
                ) : null}
                {domainObjects.map((object) => (
                  <button
                    key={object.id}
                    onClick={() => setSelectedObjectId(object.id)}
                    className={`w-full text-left p-3 rounded border transition-colors ${
                      selectedObject?.id === object.id
                        ? 'border-accent bg-surface-tertiary'
                        : 'border-border bg-surface-primary hover:border-accent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm text-content-primary">{object.label}</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${badgeClasses(object.kind)}`}>{object.kind}</span>
                    </div>
                    <p className="text-xs text-content-tertiary mt-1">{object.sourceModel}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="xl:col-span-4 bg-surface-elevated border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-content-primary mb-3">Object Detail</h2>
              {!selectedObject ? (
                <p className="text-sm text-content-tertiary">Select an object to inspect metadata.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-mono text-content-primary">{selectedObject.label}</p>
                    <p className="text-content-tertiary text-xs">{selectedObject.sourceModel}</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-tertiary">Object Type</p>
                    <p className="text-content-primary capitalize">{selectedObject.kind}</p>
                  </div>
                  <div>
                    <p className="text-xs text-content-tertiary">Column Count</p>
                    <p className="text-content-primary">{selectedObject.columnCount}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'lineage_explorer' && (
          <section className="bg-surface-elevated border border-border rounded-lg p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="text-sm font-semibold text-content-primary">Lineage Explorer</h2>
            </div>

            <div className="overflow-auto border border-border rounded">
              <table className="w-full text-xs">
                <thead className="bg-surface-primary">
                  <tr>
                    <th className="text-left px-3 py-2 border-b border-border">Business Object</th>
                    <th className="text-left px-3 py-2 border-b border-border">Source</th>
                    <th className="text-left px-3 py-2 border-b border-border">Bronze</th>
                    <th className="text-left px-3 py-2 border-b border-border">Silver</th>
                    <th className="text-left px-3 py-2 border-b border-border">Analytics</th>
                    <th className="text-left px-3 py-2 border-b border-border">Metric</th>
                    <th className="text-left px-3 py-2 border-b border-border">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLineage.map((row, index) => (
                    <tr key={`${row.businessObject}-${index}`} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                      <td className="px-3 py-2 border-t border-border text-content-primary">{row.businessObject}</td>
                      <td className="px-3 py-2 border-t border-border font-mono text-content-tertiary">{row.source}</td>
                      <td className="px-3 py-2 border-t border-border font-mono text-content-tertiary">{row.bronze}</td>
                      <td className="px-3 py-2 border-t border-border font-mono text-content-tertiary">{row.silver}</td>
                      <td className="px-3 py-2 border-t border-border font-mono text-content-tertiary">{row.analytics}</td>
                      <td className="px-3 py-2 border-t border-border font-mono text-content-tertiary">{row.metric}</td>
                      <td className="px-3 py-2 border-t border-border text-content-primary">{row.signal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
