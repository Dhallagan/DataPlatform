'use client';

import { useEffect, useMemo, useState } from 'react';
import Toolbar from '@/components/Toolbar';
import { getMonitoringOverview, MonitoringOverview, saveSchemaBaseline } from '@/lib/api';

function fmtTime(value: string | null): string {
  if (!value) return 'No timestamp';
  return new Date(value).toLocaleString();
}

export default function MonitoringPage() {
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBaseline, setIsSavingBaseline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const data = await getMonitoringOverview();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const schemaRows = useMemo(() => {
    if (!overview) return [];
    return Object.entries(overview.by_schema).sort((a, b) => a[0].localeCompare(b[0]));
  }, [overview]);

  const saveBaseline = async () => {
    try {
      setIsSavingBaseline(true);
      await saveSchemaBaseline();
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schema baseline');
    } finally {
      setIsSavingBaseline(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-surface-elevated border border-border rounded-lg p-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-content-primary">Data Ops Monitoring</h1>
            <p className="text-sm text-content-tertiary">Freshness, schema health, and drift status for warehouse layers.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadOverview}
              className="px-3 py-1.5 rounded-lg text-sm bg-surface-tertiary hover:bg-surface-primary text-content-primary"
              disabled={isLoading}
            >
              Refresh
            </button>
            <button
              onClick={saveBaseline}
              className="px-3 py-1.5 rounded-lg text-sm bg-accent text-white disabled:opacity-60"
              disabled={isSavingBaseline}
            >
              {isSavingBaseline ? 'Saving...' : 'Set Schema Baseline'}
            </button>
          </div>
        </section>

        {error && (
          <section className="bg-red-500/10 border border-red-500/30 text-red-700 rounded-lg p-4 text-sm">
            {error}
          </section>
        )}

        {isLoading || !overview ? (
          <section className="bg-surface-elevated border border-border rounded-lg p-5 text-sm text-content-tertiary">
            Loading monitoring snapshot...
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Snapshot Time</p>
                <p className="text-sm text-content-primary mt-1">{fmtTime(overview.generated_at)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Tracked Tables</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">{overview.schema_summary.table_count}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Tracked Columns</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">{overview.schema_summary.column_count}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Schema Drift Events</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">
                  {overview.schema_drift.added_tables.length + overview.schema_drift.removed_tables.length + overview.schema_drift.changed_tables.length}
                </p>
              </div>
            </section>

            <section className="bg-surface-elevated border border-border rounded-lg p-5">
              <h2 className="text-base font-semibold text-content-primary mb-3">Freshness by Schema</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-content-tertiary">
                      <th className="pb-2 pr-4">Schema</th>
                      <th className="pb-2 pr-4">Tables</th>
                      <th className="pb-2 pr-4">Tables Missing Freshness</th>
                      <th className="pb-2">Freshest Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemaRows.map(([schemaName, bucket]) => (
                      <tr key={schemaName} className="border-t border-border/60">
                        <td className="py-2 pr-4 font-mono text-content-primary">{schemaName}</td>
                        <td className="py-2 pr-4">{bucket.table_count}</td>
                        <td className="py-2 pr-4">{bucket.stale_tables}</td>
                        <td className="py-2">{fmtTime(bucket.freshest_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-surface-elevated border border-border rounded-lg p-5">
              <h2 className="text-base font-semibold text-content-primary mb-3">Schema Drift</h2>
              <p className="text-sm text-content-tertiary mb-3">
                Baseline: {overview.schema_drift.baseline_exists ? fmtTime(overview.schema_drift.baseline_generated_at) : 'Not set'}
              </p>
              <div className="space-y-2 text-sm">
                <p>Added tables: {overview.schema_drift.added_tables.length}</p>
                <p>Removed tables: {overview.schema_drift.removed_tables.length}</p>
                <p>Changed tables: {overview.schema_drift.changed_tables.length}</p>
              </div>
            </section>

            <section className="bg-surface-elevated border border-border rounded-lg p-5">
              <h2 className="text-base font-semibold text-content-primary mb-3">Table Freshness Detail</h2>
              <div className="overflow-x-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-elevated">
                    <tr className="text-left text-content-tertiary">
                      <th className="pb-2 pr-4">Table</th>
                      <th className="pb-2 pr-4">Freshness Column</th>
                      <th className="pb-2 pr-4">Freshest Timestamp</th>
                      <th className="pb-2">Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.tables.map((row) => (
                      <tr key={row.table} className="border-t border-border/60">
                        <td className="py-2 pr-4 font-mono text-content-primary">{row.table}</td>
                        <td className="py-2 pr-4">{row.freshness_column}</td>
                        <td className="py-2 pr-4">{fmtTime(row.freshest_at)}</td>
                        <td className="py-2">{row.row_count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
