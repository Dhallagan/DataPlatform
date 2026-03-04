'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell, Badge, Card, DataTable, EmptyState, LoadingState, PageHeader, SearchInput } from '@/components/ui';

interface TablesCatalogPayload {
  success: boolean;
  detail?: string;
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

interface SchemaRow {
  table: string;
  schema: string;
  columns: number;
  owner: string;
  certified: boolean;
  freshnessColumn: string;
}

export default function SchemaPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<SchemaRow[]>([]);
  const [source, setSource] = useState('unknown');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/metadata/tables');
        const payload = (await response.json()) as TablesCatalogPayload;
        if (!response.ok || !payload.success || !payload.catalog) {
          throw new Error(payload.detail || 'Failed to load schema catalog');
        }
        const nextRows = payload.catalog.tables.map((row) => ({
          table: row.table,
          schema: row.table_schema,
          columns: Number(row.column_count || 0),
          owner: row.owner || 'Unknown',
          certified: Boolean(row.certified),
          freshnessColumn: row.freshness_column || 'n/a',
        }));
        setRows(nextRows);
        setSource(payload.catalog.source || 'unknown');
        setGeneratedAt(payload.catalog.generated_at || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schema catalog');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      return (
        row.table.toLowerCase().includes(term) ||
        row.schema.toLowerCase().includes(term) ||
        row.owner.toLowerCase().includes(term)
      );
    });
  }, [rows, search]);

  if (loading) {
    return (
      <AppShell>
        <LoadingState title="Loading schema catalog" description="Fetching central table inventory." />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <EmptyState title="Schema catalog unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          title="Schema Catalog"
          subtitle="Complete table inventory for the data platform."
          filters={<SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search table, schema, or owner" />}
        />

        <Card variant="default" className="p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
            <Badge variant="neutral">{filteredRows.length} tables</Badge>
            <Badge variant="neutral">source: {source}</Badge>
            <Badge variant="neutral">generated: {generatedAt || 'unknown'}</Badge>
          </div>
        </Card>

        <DataTable<SchemaRow>
          columns={[
            { key: 'table', header: 'Table' },
            { key: 'schema', header: 'Schema' },
            { key: 'columns', header: 'Columns', align: 'right' },
            { key: 'owner', header: 'Owner' },
            {
              key: 'certified',
              header: 'Certified',
              render: (row: SchemaRow) => <Badge variant={row.certified ? 'success' : 'neutral'}>{row.certified ? 'Yes' : 'No'}</Badge>,
            },
            { key: 'freshnessColumn', header: 'Freshness Column' },
          ]}
          rows={filteredRows}
          emptyLabel="No tables match this search."
        />
      </div>
    </AppShell>
  );
}
