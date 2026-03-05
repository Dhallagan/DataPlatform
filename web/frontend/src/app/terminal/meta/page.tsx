'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, DataTable, SearchInput } from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import TerminalSection, { TerminalDataStatus } from '@/components/terminal/TerminalSection';

interface TablesCatalogPayload {
  success: boolean;
  catalog?: {
    source?: string;
    generated_at?: string;
    tables: Array<{
      table: string;
      table_schema: string;
      table_name: string;
      column_count: number;
      owner?: string | null;
      certified?: boolean;
      freshness_column?: string | null;
    }>;
  };
}

interface SchemaInventoryPayload {
  schema?: Record<string, Array<{ name: string }>>;
}

interface SchemaRow {
  table: string;
  tableName: string;
  schema: string;
  columns: number;
  owner: string;
  freshnessColumn: string;
  layer: string;
}

interface DictionaryRow {
  table: string;
  layer: string;
  definition: string;
  owner: string;
}

function mapTableToLayer(schema: string, tableName: string): string {
  const s = schema.toLowerCase();
  const t = tableName.toLowerCase();
  if (s === 'term' || s.startsWith('term_') || s.startsWith('terminal')) return 'Terminal';
  if (t.startsWith('terminal_') || t.startsWith('term_') || t.endsWith('_terminal')) return 'Terminal';
  if (s.startsWith('bronze')) return 'Bronze';
  if (s.startsWith('silver') || s === 'core') return 'Silver/Core';
  if (['fin', 'gtm', 'pro', 'ops', 'eng', 'growth', 'finance', 'product', 'gold', 'marts'].includes(s)) return 'Gold Domain';
  return 'Other';
}

function humanizeName(name: string): string {
  return name
    .replace(/^(agg_|kpi_|dim_|fct_|stg_|snap_|cfg_)/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase());
}

function tableDefinition(row: SchemaRow): string {
  const label = humanizeName(row.tableName);
  if (row.layer === 'Terminal') return `Terminal surface for ${label.toLowerCase()} metrics and operating review.`;
  if (row.layer === 'Gold Domain') return `Domain mart for ${label.toLowerCase()} used in business reporting.`;
  if (row.layer === 'Silver/Core') return `Conformed model for ${label.toLowerCase()} used as reusable building block.`;
  if (row.layer === 'Bronze') return `Raw replicated source table for ${label.toLowerCase()}.`;
  return `Modeled table for ${label.toLowerCase()}.`;
}

export default function TerminalMetaPage() {
  const [schemaRows, setSchemaRows] = useState<SchemaRow[]>([]);
  const [warehouseSchemaRows, setWarehouseSchemaRows] = useState<SchemaRow[]>([]);
  const [schemaSearch, setSchemaSearch] = useState('');
  const [schemaSource, setSchemaSource] = useState('unknown');
  const [schemaGeneratedAt, setSchemaGeneratedAt] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    async function loadMeta() {
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const [schemaResponse, inventoryResponse] = await Promise.all([
          fetch('/api/metadata/tables', { signal: controller.signal }),
          fetch('/api/schema', { signal: controller.signal }),
        ]);

        if (!mounted) return;

        if (schemaResponse.ok) {
          const schemaPayload = (await schemaResponse.json()) as TablesCatalogPayload;
          if (schemaPayload.success && schemaPayload.catalog) {
            setSchemaRows(
              schemaPayload.catalog.tables.map((row) => ({
                table: row.table,
                tableName: row.table_name,
                schema: row.table_schema,
                columns: Number(row.column_count || 0),
                owner: row.owner || 'Unknown',
                freshnessColumn: row.freshness_column || 'n/a',
                layer: mapTableToLayer(row.table_schema || '', row.table_name || ''),
              })),
            );
            setSchemaSource(schemaPayload.catalog.source || 'unknown');
            setSchemaGeneratedAt(schemaPayload.catalog.generated_at || null);
          } else {
            setSchemaError('Schema catalog response was empty.');
          }
        } else {
          setSchemaError(`Schema request failed (${schemaResponse.status}).`);
        }

        if (inventoryResponse.ok) {
          const inventoryPayload = (await inventoryResponse.json()) as SchemaInventoryPayload;
          const schemaMap = inventoryPayload.schema || {};
          const flattened = Object.entries(schemaMap).map(([qualifiedName, columns]) => {
            const dotIndex = qualifiedName.indexOf('.');
            const schema = dotIndex > 0 ? qualifiedName.slice(0, dotIndex) : 'unknown';
            const tableName = dotIndex > 0 ? qualifiedName.slice(dotIndex + 1) : qualifiedName;
            return {
              table: qualifiedName,
              tableName,
              schema,
              columns: Array.isArray(columns) ? columns.length : 0,
              owner: 'n/a',
              freshnessColumn: 'n/a',
              layer: mapTableToLayer(schema, tableName),
            } satisfies SchemaRow;
          });
          setWarehouseSchemaRows(flattened);
        }
      } catch (err) {
        if (!mounted) return;
        setSchemaError(err instanceof Error ? err.message : 'Meta request failed');
      } finally {
        if (mounted) setSchemaLoading(false);
        clearTimeout(timeout);
      }
    }

    loadMeta();
    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  const filteredSchemaRows = useMemo(() => {
    const term = schemaSearch.trim().toLowerCase();
    if (!term) return schemaRows;
    return schemaRows.filter((row) => {
      return row.table.toLowerCase().includes(term) || row.schema.toLowerCase().includes(term) || row.owner.toLowerCase().includes(term) || row.layer.toLowerCase().includes(term);
    });
  }, [schemaRows, schemaSearch]);

  const rowsForLayerSummary = warehouseSchemaRows.length ? warehouseSchemaRows : schemaRows;

  const layerSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rowsForLayerSummary) counts.set(row.layer, (counts.get(row.layer) || 0) + 1);
    return {
      bronze: counts.get('Bronze') || 0,
      silver: counts.get('Silver/Core') || 0,
      gold: counts.get('Gold Domain') || 0,
      terminal: counts.get('Terminal') || 0,
    };
  }, [rowsForLayerSummary]);

  const ownerByTable = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of schemaRows) map.set(row.table, row.owner);
    return map;
  }, [schemaRows]);

  const filteredWarehouseRows = useMemo(() => {
    const term = schemaSearch.trim().toLowerCase();
    if (!term) return warehouseSchemaRows;
    return warehouseSchemaRows
      .filter((row) =>
        row.table.toLowerCase().includes(term) ||
        row.schema.toLowerCase().includes(term) ||
        row.layer.toLowerCase().includes(term),
      );
  }, [schemaSearch, warehouseSchemaRows]);

  const martRows = useMemo(
    () => filteredWarehouseRows.filter((row) => row.layer === 'Gold Domain' || row.layer === 'Terminal'),
    [filteredWarehouseRows],
  );

  const dictionaryRows = useMemo<DictionaryRow[]>(
    () =>
      filteredWarehouseRows.map((row) => ({
        table: row.table,
        layer: row.layer,
        definition: tableDefinition(row),
        owner: ownerByTable.get(row.table) || 'n/a',
      })),
    [filteredWarehouseRows, ownerByTable],
  );

  const layerValue = (value: number) => (schemaLoading ? '—' : String(value));

  return (
    <TerminalShell active="meta" title="Metadata Terminal" subtitle="Clear map of the data layer used by the terminal.">
      <div className="space-y-3">
        <TerminalDataStatus
          freshnessLabel={schemaLoading ? 'Loading metadata...' : schemaGeneratedAt ? `Catalog updated ${schemaGeneratedAt}` : 'Catalog freshness unknown'}
          coverageLabel={schemaLoading ? 'Loading table counts...' : `${schemaRows.length} modeled tables · ${warehouseSchemaRows.length} warehouse tables`}
          qualityLabel={schemaError ? 'Metadata API issue detected' : 'Metadata inventory loaded'}
        />

        <TerminalSection title="Data Layer At A Glance" subtitle="How data moves from source ingestion to terminal marts." command="META [DICT|SCHEMA]">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded border border-border bg-surface-primary p-2 text-xs"><p className="text-content-tertiary">Bronze</p><p className="mt-1 text-lg font-semibold text-content-primary">{layerValue(layerSummary.bronze)}</p></div>
            <div className="rounded border border-border bg-surface-primary p-2 text-xs"><p className="text-content-tertiary">Silver/Core</p><p className="mt-1 text-lg font-semibold text-content-primary">{layerValue(layerSummary.silver)}</p></div>
            <div className="rounded border border-border bg-surface-primary p-2 text-xs"><p className="text-content-tertiary">Gold</p><p className="mt-1 text-lg font-semibold text-content-primary">{layerValue(layerSummary.gold)}</p></div>
            <div className="rounded border border-border bg-surface-primary p-2 text-xs"><p className="text-content-tertiary">Terminal</p><p className="mt-1 text-lg font-semibold text-content-primary">{layerValue(layerSummary.terminal)}</p></div>
          </div>
        </TerminalSection>

        <TerminalSection title="Data Dictionary" subtitle="Live table dictionary: table + what it is + owner." command="META DICT">
          {schemaError ? <p className="mb-2 text-xs text-status-danger">{schemaError}</p> : null}
          <SearchInput
            value={schemaSearch}
            onChange={(event) => setSchemaSearch(event.target.value)}
            placeholder="Search table, schema, layer, or owner"
          />
          <div className="mt-2">
            <DataTable<DictionaryRow>
              columns={[
                { key: 'table', header: 'Table' },
                { key: 'layer', header: 'Layer' },
                { key: 'definition', header: 'Definition' },
                { key: 'owner', header: 'Owner' },
              ]}
              rows={dictionaryRows}
              emptyLabel="No dictionary rows match this search."
            />
          </div>
        </TerminalSection>

        <TerminalSection title="Schema Inventory" subtitle="Warehouse = what exists now. Catalog = dbt-modeled tables with ownership metadata." command="META SCHEMA">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-content-secondary">
            <Badge variant="neutral">catalog source: {schemaSource}</Badge>
            <Badge variant="neutral">warehouse marts {martRows.length}</Badge>
            <Badge variant="neutral">warehouse tables {warehouseSchemaRows.length}</Badge>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-content-tertiary">Modeled Marts (Gold + Terminal)</p>
              <DataTable<SchemaRow>
                columns={[
                  { key: 'table', header: 'Table' },
                  { key: 'layer', header: 'Layer' },
                  { key: 'schema', header: 'Namespace' },
                  { key: 'columns', header: 'Columns', align: 'right' },
                  { key: 'owner', header: 'Owner' },
                  { key: 'freshnessColumn', header: 'Freshness' },
                ]}
                rows={martRows}
                emptyLabel="No mart rows match this search."
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-content-tertiary">Full Warehouse Schema</p>
              {schemaLoading ? <p className="mb-2 text-xs text-content-tertiary">Loading schema...</p> : null}
              <DataTable<SchemaRow>
                columns={[
                  { key: 'table', header: 'Table' },
                  { key: 'layer', header: 'Layer' },
                  { key: 'schema', header: 'Namespace' },
                  { key: 'columns', header: 'Columns', align: 'right' },
                ]}
                rows={filteredWarehouseRows}
                emptyLabel="No warehouse tables match this search."
              />
            </div>
          </div>
        </TerminalSection>
      </div>
    </TerminalShell>
  );
}
