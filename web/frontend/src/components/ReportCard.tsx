'use client';

import { useRouter } from 'next/navigation';
import { ToolCall, ToolResult } from '@/lib/api';
import { exportToExcel } from '@/lib/excelExport';

interface ReportCardProps {
  toolCall: ToolCall;
  toolResult: ToolResult;
}

const REPORT_META: Record<string, { name: string; icon: string }> = {
  // Billing & Revenue
  revenue_by_client: { name: 'Revenue by Client', icon: '📊' },
  revenue_by_attorney: { name: 'Revenue by Attorney', icon: '👔' },
  revenue_by_matter: { name: 'Revenue by Matter', icon: '📁' },
  revenue_by_practice_area: { name: 'Revenue by Practice Area', icon: '🏛️' },
  billing_summary: { name: 'Billing Summary', icon: '📋' },
  // AR & Collections
  ar_aging_by_client: { name: 'AR Aging by Client', icon: '📅' },
  ar_aging_by_attorney: { name: 'AR Aging by Attorney', icon: '⏰' },
  collections_report: { name: 'Collections Report', icon: '💵' },
  write_offs_report: { name: 'Write-offs Report', icon: '✂️' },
  realization_report: { name: 'Realization Report', icon: '📈' },
  // Time & Productivity
  timekeeper_productivity: { name: 'Timekeeper Productivity', icon: '⏱️' },
  daily_time_summary: { name: 'Daily Time Summary', icon: '📆' },
  utilization_report: { name: 'Utilization Report', icon: '📉' },
  unbilled_wip: { name: 'Unbilled WIP', icon: '🔄' },
  time_by_matter: { name: 'Time by Matter', icon: '⌛' },
  // Matter & Client Analysis
  matter_profitability: { name: 'Matter Profitability', icon: '💰' },
  client_profitability: { name: 'Client Profitability', icon: '💎' },
  new_matters_report: { name: 'New Matters', icon: '🆕' },
  matter_status_report: { name: 'Matter Status', icon: '📊' },
  client_activity_report: { name: 'Client Activity', icon: '📜' },
  // Tools
  execute_query: { name: 'Query Results', icon: '⚡' },
  introspect_schema: { name: 'Database Schema', icon: '🗄️' },
};

interface ResultData {
  success?: boolean;
  data?: Record<string, unknown>[];
  columns?: string[];
  total?: number;
  total_outstanding?: number;
  error?: string;
  row_count?: number;
  count?: number;
}

export default function ReportCard({ toolCall, toolResult }: ReportCardProps) {
  const router = useRouter();
  const meta = REPORT_META[toolResult.tool] || { name: toolResult.tool, icon: '📄' };
  const data = toolResult.result as ResultData;

  const isSuccess = data?.success !== false && !data?.error;
  const rows = data?.data || [];
  const rowCount = rows.length || data?.row_count || data?.count || 0;

  // Build URL with parameters
  const getReportUrl = () => {
    const params = new URLSearchParams();
    Object.entries(toolCall.args).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.set(key, String(value));
      }
    });
    const query = params.toString();
    return `/reports/${toolResult.tool}${query ? `?${query}` : ''}`;
  };

  // Export to Excel
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rows.length) return;

    const cols = data?.columns || Object.keys(rows[0]);
    const subtitle = generateSubtitle();

    await exportToExcel({
      title: meta.name,
      subtitle,
      columns: cols,
      rows,
      filename: `${toolResult.tool}_${new Date().toISOString().split('T')[0]}.xlsx`,
    });
  };

  const handleClick = () => {
    router.push(getReportUrl());
  };

  // Generate subtitle from parameters
  const generateSubtitle = () => {
    const args = toolCall.args;
    const parts: string[] = [];

    // Date range
    if (args.start_date && args.end_date) {
      const start = formatDate(args.start_date as string);
      const end = formatDate(args.end_date as string);
      parts.push(`${start} – ${end}`);
    } else if (args.as_of_date) {
      parts.push(`As of ${formatDate(args.as_of_date as string)}`);
    } else if (args.work_date) {
      parts.push(formatDate(args.work_date as string));
    }

    // Filters
    if (args.client_id) parts.push(`Client #${args.client_id}`);
    if (args.attorney_id) parts.push(`Attorney #${args.attorney_id}`);
    if (args.matter_id) parts.push(`Matter #${args.matter_id}`);
    if (args.practice_area) parts.push(`${args.practice_area}`);
    if (args.status) parts.push(`Status: ${args.status}`);

    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get preview rows
  const previewRows = rows.slice(0, 3);
  const columns = data?.columns || (rows[0] ? Object.keys(rows[0]) : []);

  if (!isSuccess) {
    return (
      <div className="bg-error/5 border border-error/20 rounded-lg p-3">
        <div className="flex items-center gap-2 text-error text-sm">
          <span>Error: {data?.error || 'Failed to execute'}</span>
        </div>
      </div>
    );
  }

  const subtitle = generateSubtitle();

  return (
    <div
      onClick={handleClick}
      className="bg-surface-elevated border border-border rounded-lg overflow-hidden cursor-pointer hover:border-accent hover:shadow-soft transition-all group"
    >
      {/* Header with Title & Subtitle */}
      <div className="px-4 py-3 bg-surface-secondary border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base">{meta.icon}</span>
              <h3 className="text-base font-bold text-content-primary group-hover:text-accent transition-colors truncate">
                {meta.name}
              </h3>
              <span className="text-xs text-content-tertiary bg-surface-tertiary px-1.5 py-0.5 rounded flex-shrink-0">
                {rowCount} {rowCount === 1 ? 'row' : 'rows'}
              </span>
            </div>
            {subtitle && (
              <p className="text-xs text-content-secondary mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {rows.length > 0 && (
              <button
                onClick={handleDownload}
                className="p-1.5 rounded hover:bg-surface-tertiary text-content-tertiary hover:text-content-primary transition-colors"
                title="Download Excel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
            )}
            <div className="p-1.5 rounded text-content-tertiary group-hover:text-accent transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Summary metrics */}
      {(data?.total !== undefined || data?.total_outstanding !== undefined) && (
        <div className="px-3 py-1.5 bg-surface-tertiary/30 border-b border-border flex items-center gap-4 text-xs">
          {data.total_outstanding !== undefined && (
            <span>
              <span className="text-content-tertiary">Outstanding: </span>
              <span className="font-semibold text-warning">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.total_outstanding)}
              </span>
            </span>
          )}
          {data.total !== undefined && (
            <span>
              <span className="text-content-tertiary">Total: </span>
              <span className="font-semibold text-content-primary">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.total)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Preview table */}
      {previewRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-secondary/50">
                {columns.slice(0, 5).map(col => (
                  <th key={col} className="px-2 py-1 text-left text-[10px] font-medium text-content-tertiary uppercase tracking-wide whitespace-nowrap">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
                {columns.length > 5 && (
                  <th className="px-2 py-1 text-left text-[10px] font-medium text-content-tertiary">...</th>
                )}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-surface-primary' : 'bg-surface-secondary/30'}>
                  {columns.slice(0, 5).map(col => (
                    <td key={col} className="px-2 py-1 text-content-primary whitespace-nowrap font-mono">
                      {formatCellValue(row[col], col)}
                    </td>
                  ))}
                  {columns.length > 5 && (
                    <td className="px-2 py-1 text-content-tertiary">...</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {rowCount > 3 && (
        <div className="px-3 py-1.5 bg-surface-tertiary/30 border-t border-border">
          <span className="text-[10px] text-content-tertiary">
            + {rowCount - 3} more rows · Click to view full report
          </span>
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: unknown, column: string): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    const lower = column.toLowerCase();
    if (['amount', 'total', 'revenue', 'balance', 'price', 'outstanding', 'current', 'days'].some(t => lower.includes(t))) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
    }
    return value.toLocaleString();
  }
  const str = String(value);
  return str.length > 20 ? str.slice(0, 20) + '...' : str;
}
