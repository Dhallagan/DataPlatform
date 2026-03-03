'use client';

import Link from 'next/link';
import { ReportDefinition, ReportResult } from '@/lib/reports';
import MetricHelpButton from '@/components/MetricHelpButton';
import { MetricContract, getMetricContract } from '@/lib/metricGlossary';

interface DashboardState {
  isLoading: boolean;
  result: ReportResult | null;
  error: string | null;
}

interface ReportDashboardCardProps {
  report: ReportDefinition;
  state: DashboardState;
  onRefresh?: () => void;
  showOpenLink?: boolean;
}

function extractReportSources(report: ReportDefinition): string[] {
  const sqlParam = report.parameters.find((param) => param.name === 'sql');
  if (!sqlParam || typeof sqlParam.default !== 'string') return [];

  const sql = sqlParam.default;
  const pattern = /\b(?:from|join)\s+([A-Za-z0-9_."`]+)/gi;
  const sources = new Set<string>();

  let match = pattern.exec(sql);
  while (match) {
    const raw = (match[1] || '').trim();
    if (raw) {
      const normalized = raw.replace(/[`"]/g, '').replace(/,+$/, '');
      if (normalized) {
        sources.add(normalized);
      }
    }
    match = pattern.exec(sql);
  }

  return Array.from(sources);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

function isDateColumn(column: string): boolean {
  const lower = column.toLowerCase();
  return lower.includes('date') || lower.includes('week') || lower.includes('month');
}

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export default function ReportDashboardCard({
  report,
  state,
  onRefresh,
  showOpenLink = true,
}: ReportDashboardCardProps) {
  const sources = extractReportSources(report);
  const rows = state.result?.data || [];
  const columns = state.result?.columns || (rows[0] ? Object.keys(rows[0]) : []);
  const previewRows = rows.slice(0, 8);
  const previewColumns = columns.slice(0, 6);

  const kpis = (() => {
    if (rows.length === 0) return [];
    const first = rows[rows.length - 1];
    return Object.entries(first)
      .filter(([, value]) => isNumeric(value))
      .slice(0, 3);
  })();

  const reportContract: MetricContract = getMetricContract(`report.${report.id}`) || {
    key: `report.${report.id}`,
    title: report.name,
    domain: 'shared',
    kind: 'metric',
    definition: report.description,
    formula: 'Defined by report SQL in the report catalog.',
    grain: 'Report query output grain',
    sourceOfTruth: sources.length > 0 ? sources : ['See report SQL'],
    owner: 'Domain owner (to be assigned)',
    approver: 'Data Platform',
    onCall: '#data-platform-oncall',
    instrumentation: 'Contract placeholder: add explicit metric formula and owner.',
    status: 'draft',
    certification: 'provisional',
    hasTests: false,
    sla: 'TBD',
    freshnessSlo: 'TBD',
    dataQualitySlo: 'TBD',
    testPassRate: 'TBD',
    lineage: 'Defined in report SQL',
    runbook: '/docs/metrics-governance#metric-change-workflow',
    agentActions: ['none_defined'],
    lastRefreshedAt: 'TBD',
    version: 'v0',
    updatedAt: '2026-03-02',
  };

  return (
    <article className="rounded-lg border border-border bg-surface-elevated overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-content-primary">{report.name}</h3>
          <p className="text-xs text-content-tertiary mt-0.5">{report.description}</p>
          {sources.length > 0 && (
            <p className="text-[11px] text-content-tertiary mt-1">
              Source: <span className="font-mono">{sources.join(', ')}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <MetricHelpButton contract={reportContract} />
          {showOpenLink && (
            <Link href={`/reports/${report.id}`} className="text-xs text-accent hover:underline">
              Open
            </Link>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-xs px-2 py-1 rounded bg-surface-tertiary hover:bg-surface-primary"
              disabled={state.isLoading}
            >
              {state.isLoading ? 'Loading...' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {state.error && (
        <div className="p-4 text-sm text-error bg-error/10 border-t border-error/20">
          {state.error}
        </div>
      )}

      {!state.error && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {kpis.map(([key, value]) => (
              <div key={key} className="bg-surface-primary border border-border rounded p-2">
                <p className="text-[10px] uppercase tracking-wide text-content-tertiary">
                  {key.replace(/_/g, ' ')}
                </p>
                <p className="text-sm font-semibold text-content-primary mt-1">{formatValue(value)}</p>
              </div>
            ))}
            {kpis.length === 0 && (
              <div className="col-span-3 text-xs text-content-tertiary bg-surface-primary border border-border rounded p-2">
                No numeric KPI fields in first result row.
              </div>
            )}
          </div>

          <div className="border border-border rounded overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-primary">
                <tr>
                  {previewColumns.map((column) => (
                    <th key={`${report.id}-${column}`} className="text-left px-2 py-1 border-b border-border text-content-secondary font-medium">
                      {column.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-content-tertiary" colSpan={Math.max(previewColumns.length, 1)}>
                      {state.isLoading ? 'Loading data...' : 'No rows'}
                    </td>
                  </tr>
                ) : (
                  previewRows.map((row, rowIdx) => (
                    <tr key={`${report.id}-row-${rowIdx}`} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                      {previewColumns.map((column) => (
                        <td key={`${report.id}-row-${rowIdx}-${column}`} className="px-2 py-1 border-t border-border text-content-primary whitespace-nowrap">
                          {isDateColumn(column) ? String(row[column]).slice(0, 10) : formatValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}
