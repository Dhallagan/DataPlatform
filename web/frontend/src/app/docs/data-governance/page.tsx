'use client';

import { useEffect, useMemo, useState } from 'react';
import DocMeta from '@/components/DocMeta';

const SOURCE_TABLES = [
  {
    name: 'organizations',
    purpose: 'Master account entity. Defines who the customer is.',
    keys: 'id',
  },
  {
    name: 'users',
    purpose: 'User identity, profile, and login lifecycle.',
    keys: 'id',
  },
  {
    name: 'organization_members',
    purpose: 'User-to-organization membership and role mapping.',
    keys: 'id, organization_id, user_id',
  },
  {
    name: 'projects',
    purpose: 'Project-level grouping for browser automations.',
    keys: 'id, organization_id',
  },
  {
    name: 'api_keys',
    purpose: 'Programmatic access credentials and usage status.',
    keys: 'id, organization_id',
  },
  {
    name: 'browser_sessions',
    purpose: 'Session-level runtime facts (status, duration, bytes, proxy, stealth).',
    keys: 'id, organization_id, project_id, api_key_id',
  },
  {
    name: 'session_events',
    purpose: 'Granular event stream for each browser session.',
    keys: 'id, session_id',
  },
  {
    name: 'plans',
    purpose: 'Commercial packaging and entitlements.',
    keys: 'id',
  },
  {
    name: 'subscriptions',
    purpose: 'Plan enrollment and lifecycle state by organization.',
    keys: 'id, organization_id, plan_id',
  },
  {
    name: 'usage_records',
    purpose: 'Usage measured for billing windows.',
    keys: 'id, organization_id, subscription_id',
  },
  {
    name: 'invoices',
    purpose: 'Billed financial outcomes and collection status.',
    keys: 'id, organization_id, subscription_id',
  },
];

const WAREHOUSE_LAYERS = [
  {
    schema: 'bronze_supabase',
    role: 'Raw replicated source tables.',
    examples: 'organizations, users, browser_sessions, invoices',
  },
  {
    schema: 'silver',
    role: 'Standardized staging views plus canonical entities and semantic facts.',
    examples: 'stg_organizations, organizations, sessions, fct_runs, dim_organizations',
  },
  {
    schema: 'core',
    role: 'Cross-domain KPI layer with canonical shared metrics.',
    examples: 'daily_kpis, metric_spine',
  },
  {
    schema: 'growth/product/finance/eng/ops',
    role: 'Domain aggregates and KPI models owned by each function.',
    examples: 'growth_task_queue, product_kpis, mrr, engineering_daily, ops_kpis',
  },
];

const KPI_GLOSSARY = [
  {
    metric: 'Success Rate %',
    source: 'core.daily_kpis / domain daily models',
    definition: 'Share of successful sessions out of total sessions.',
    calc: '(successful_sessions / total_sessions) * 100',
  },
  {
    metric: 'Daily Active Organizations (DAU)',
    source: 'core.daily_kpis',
    definition: 'Distinct organizations with at least one session on a date.',
    calc: 'count(distinct organization_id) where session_date = date',
  },
  {
    metric: 'MRR',
    source: 'finance.mrr',
    definition: 'Monthly recurring revenue grouped by plan and total.',
    calc: 'sum(active_subscription_plan_price_usd)',
  },
  {
    metric: 'Activation Rate 7d',
    source: 'growth.growth_daily / growth.growth_kpis',
    definition: 'Percent of newly created orgs that run at least one session within 7 days.',
    calc: '(activated_orgs_7d / new_organizations) * 100',
  },
  {
    metric: 'Collection Rate %',
    source: 'finance.monthly_revenue',
    definition: 'How much invoiced revenue is realized vs total billed.',
    calc: '(realized_revenue_usd / gross_revenue_usd) * 100',
  },
  {
    metric: 'Proxy Adoption %',
    source: 'product.product_daily / product.product_kpis',
    definition: 'Share of sessions using proxy infrastructure.',
    calc: '(sessions_with_proxy / total_sessions) * 100',
  },
];

interface SchemaColumnRow {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
}

interface QueryPayload {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}

interface TableColumns {
  fullName: string;
  schema: string;
  table: string;
  columns: Array<{ name: string; type: string }>;
}

function getTableTechnicalSummary(schema: string, table: string): string {
  if (schema === 'silver' && table.startsWith('stg_')) {
    return 'Staging model used to normalize raw source records, standardize data types, and prepare stable inputs for core business models.';
  }
  if (schema === 'silver' && (table === 'organizations' || table === 'users' || table === 'sessions')) {
    return 'Canonical core entity table. This layer defines trusted business entities with cleaned keys and reusable relationships.';
  }
  if (schema === 'silver' && table.startsWith('dim_')) {
    return 'Dimension table with descriptive attributes used for filtering, grouping, and consistent business slicing across reports.';
  }
  if (schema === 'silver' && table.startsWith('fct_')) {
    return 'Fact table containing event-like or transactional records at a defined grain used for downstream aggregates and KPI computation.';
  }
  if (['growth', 'product', 'finance', 'eng', 'ops'].includes(schema)) {
    return 'Business mart aggregate. This model rolls up core facts into analysis-ready measures for a specific domain and time grain.';
  }
  if (schema === 'core' && table === 'daily_kpis') {
    return 'Governed KPI view that exposes business definitions in a self-serve format for dashboards and operational reporting.';
  }
  if (schema === 'core' && table === 'metric_spine') {
    return 'Daily metric spine used as a canonical base for organization-level KPI analysis and cross-domain metric alignment.';
  }
  return 'Warehouse model containing curated columns used in downstream analytics and metric definitions.';
}

export default function DataGovernancePage() {
  const [tableColumns, setTableColumns] = useState<TableColumns[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(true);
  const [columnsError, setColumnsError] = useState<string | null>(null);

  useEffect(() => {
    async function loadColumns() {
      setColumnsLoading(true);
      setColumnsError(null);
      try {
        const sql = `
          SELECT
            table_schema,
            table_name,
            column_name,
            data_type
          FROM information_schema.columns
          WHERE table_schema IN ('silver', 'growth', 'product', 'finance', 'eng', 'ops', 'core')
          ORDER BY table_schema, table_name, ordinal_position
        `;

        const response = await fetch('/api/reports/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql }),
        });
        const payload = (await response.json()) as QueryPayload;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || 'Failed to load schema columns');
        }

        const grouped = new Map<string, TableColumns>();
        for (const row of payload.data) {
          const typed = row as unknown as SchemaColumnRow;
          const schema = String(typed.table_schema || '');
          const table = String(typed.table_name || '');
          const column = String(typed.column_name || '');
          const type = String(typed.data_type || '');
          const fullName = `${schema}.${table}`;
          if (!grouped.has(fullName)) {
            grouped.set(fullName, {
              fullName,
              schema,
              table,
              columns: [],
            });
          }
          grouped.get(fullName)?.columns.push({ name: column, type });
        }

        setTableColumns(Array.from(grouped.values()));
      } catch (error) {
        setColumnsError(error instanceof Error ? error.message : 'Failed to load schema columns');
      } finally {
        setColumnsLoading(false);
      }
    }

    loadColumns();
  }, []);

  const silverTables = useMemo(
    () => tableColumns.filter((table) => table.schema === 'silver'),
    [tableColumns]
  );

  const analyticsTables = useMemo(
    () => tableColumns.filter((table) => ['growth', 'product', 'finance', 'eng', 'ops', 'core'].includes(table.schema)),
    [tableColumns]
  );

  return (
    <main className="max-w-6xl space-y-8 text-sm">
      <section className="bg-surface-elevated border border-border rounded-lg p-5">
        <h1 className="text-lg font-semibold text-content-primary">Data Governance Glossary</h1>
        <p className="text-sm text-content-secondary mt-1">
          Source schema, warehouse layers, and plain-language metric definitions.
        </p>
        <DocMeta
          owner="Data Platform"
          reviewers="Domain Analytics Leads"
          lastReviewedOn="2026-03-02"
          reviewCadence="Monthly"
        />
      </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-5 space-y-3">
          <h2 className="text-base font-semibold text-content-primary">Governance Intent</h2>
          <p className="text-content-secondary">
            This glossary defines what each layer means, which tables are authoritative, and how core metrics are calculated.
            The goal is to make metrics explainable, reusable, and consistent across Product, Growth, Engineering, Ops, and Finance.
          </p>
        </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-5">
          <h2 className="text-base font-semibold text-content-primary mb-3">1) Source Schema (Supabase)</h2>
          <div className="overflow-auto border border-border rounded">
            <table className="w-full text-xs">
              <thead className="bg-surface-primary">
                <tr>
                  <th className="text-left px-3 py-2 border-b border-border">Table</th>
                  <th className="text-left px-3 py-2 border-b border-border">Business Purpose</th>
                  <th className="text-left px-3 py-2 border-b border-border">Key Fields</th>
                </tr>
              </thead>
              <tbody>
                {SOURCE_TABLES.map((row) => (
                  <tr key={row.name} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                    <td className="px-3 py-2 border-t border-border font-mono text-content-primary">{row.name}</td>
                    <td className="px-3 py-2 border-t border-border text-content-secondary">{row.purpose}</td>
                    <td className="px-3 py-2 border-t border-border text-content-tertiary font-mono">{row.keys}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-5">
          <h2 className="text-base font-semibold text-content-primary mb-3">2) Warehouse Layers (MotherDuck)</h2>
          <div className="overflow-auto border border-border rounded">
            <table className="w-full text-xs">
              <thead className="bg-surface-primary">
                <tr>
                  <th className="text-left px-3 py-2 border-b border-border">Schema</th>
                  <th className="text-left px-3 py-2 border-b border-border">Role</th>
                  <th className="text-left px-3 py-2 border-b border-border">Representative Models</th>
                </tr>
              </thead>
              <tbody>
                {WAREHOUSE_LAYERS.map((layer) => (
                  <tr key={layer.schema} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                    <td className="px-3 py-2 border-t border-border font-mono text-content-primary">{layer.schema}</td>
                    <td className="px-3 py-2 border-t border-border text-content-secondary">{layer.role}</td>
                    <td className="px-3 py-2 border-t border-border text-content-tertiary font-mono">{layer.examples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-5">
          <h2 className="text-base font-semibold text-content-primary mb-3">3) Silver and Analytics Metric Logic</h2>
          <p className="text-content-secondary mb-3">
            Silver models standardize entities and facts. Analytics models aggregate them into KPIs. The formulas below are the shared
            metric definitions used in dashboards/reports.
          </p>
          <div className="space-y-3">
            {KPI_GLOSSARY.map((kpi) => (
              <div key={kpi.metric} className="border border-border rounded p-3 bg-surface-primary">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-content-primary">{kpi.metric}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-tertiary text-content-tertiary font-mono">
                    {kpi.source}
                  </span>
                </div>
                <p className="mt-1 text-xs text-content-secondary">{kpi.definition}</p>
                <p className="mt-1 text-xs text-content-tertiary">
                  Formula: <code className="font-mono">{kpi.calc}</code>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-5">
          <h2 className="text-base font-semibold text-content-primary mb-3">4) Silver Layer Column Dictionary (All Columns)</h2>
          <p className="text-content-secondary mb-3">
            Full column-level inventory for <code className="font-mono">silver</code> (staging + canonical core models).
          </p>
          {columnsLoading && (
            <p className="text-xs text-content-tertiary">Loading silver column metadata...</p>
          )}
          {columnsError && (
            <p className="text-xs text-error bg-error/10 border border-error/20 rounded p-2">{columnsError}</p>
          )}
          {!columnsLoading && !columnsError && (
            <div className="space-y-4">
              {silverTables.map((table) => (
                <article key={table.fullName} className="border border-border rounded bg-surface-primary p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-content-primary font-mono">{table.fullName}</h3>
                    <span className="text-[10px] text-content-tertiary bg-surface-tertiary px-2 py-0.5 rounded">
                      {table.columns.length} columns
                    </span>
                  </div>
                  <p className="text-xs text-content-secondary mb-2">{getTableTechnicalSummary(table.schema, table.table)}</p>
                  <div className="overflow-auto border border-border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-secondary">
                        <tr>
                          <th className="text-left px-2 py-1 border-b border-border">Column</th>
                          <th className="text-left px-2 py-1 border-b border-border">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns.map((column) => (
                          <tr key={`${table.fullName}.${column.name}`} className="odd:bg-surface-primary even:bg-surface-secondary/40">
                            <td className="px-2 py-1 border-t border-border font-mono text-content-primary">{column.name}</td>
                            <td className="px-2 py-1 border-t border-border font-mono text-content-tertiary">{column.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-5">
          <h2 className="text-base font-semibold text-content-primary mb-3">5) Analytics Layer Column Dictionary (All Columns)</h2>
          <p className="text-content-secondary mb-3">
            Full column-level inventory for <code className="font-mono">growth/product/finance/eng/ops/core</code>.
          </p>
          {columnsLoading && (
            <p className="text-xs text-content-tertiary">Loading analytics column metadata...</p>
          )}
          {columnsError && (
            <p className="text-xs text-error bg-error/10 border border-error/20 rounded p-2">{columnsError}</p>
          )}
          {!columnsLoading && !columnsError && (
            <div className="space-y-4">
              {analyticsTables.map((table) => (
                <article key={table.fullName} className="border border-border rounded bg-surface-primary p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-content-primary font-mono">{table.fullName}</h3>
                    <span className="text-[10px] text-content-tertiary bg-surface-tertiary px-2 py-0.5 rounded">
                      {table.columns.length} columns
                    </span>
                  </div>
                  <p className="text-xs text-content-secondary mb-2">{getTableTechnicalSummary(table.schema, table.table)}</p>
                  <div className="overflow-auto border border-border rounded">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-secondary">
                        <tr>
                          <th className="text-left px-2 py-1 border-b border-border">Column</th>
                          <th className="text-left px-2 py-1 border-b border-border">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns.map((column) => (
                          <tr key={`${table.fullName}.${column.name}`} className="odd:bg-surface-primary even:bg-surface-secondary/40">
                            <td className="px-2 py-1 border-t border-border font-mono text-content-primary">{column.name}</td>
                            <td className="px-2 py-1 border-t border-border font-mono text-content-tertiary">{column.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      <section className="bg-surface-elevated border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-content-primary mb-2">Governance Notes</h2>
        <ul className="list-disc pl-5 space-y-1 text-content-secondary">
          <li>Source tables represent events and transactions, not final business metrics.</li>
          <li>Only analytics domain/core objects should be used for KPI reporting unless explicitly documented otherwise.</li>
          <li>Metric definitions should be updated in one place and reflected consistently across all dashboards/reports.</li>
          <li>When adding new metrics, document owner, grain, refresh cadence, and expected quality checks.</li>
        </ul>
      </section>
    </main>
  );
}
