'use client';

import { useState, useMemo } from 'react';

interface SpreadsheetData {
  columns: string[];
  rows: Record<string, unknown>[];
  summary?: {
    total?: number;
    total_outstanding?: number;
    row_count?: number;
    count?: number;
    buckets?: Record<string, number>;
  };
}

interface EmbeddedSpreadsheetProps {
  data: SpreadsheetData;
  title?: string;
  subtitle?: string;
  maxHeight?: number;
  fullHeight?: boolean;
  onDownload?: () => void;
  downloadLabel?: string;
}

export default function EmbeddedSpreadsheet({
  data,
  title,
  subtitle,
  maxHeight = 300,
  fullHeight = false,
  onDownload,
  downloadLabel = 'Download',
}: EmbeddedSpreadsheetProps) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  const { columns, rows } = data;

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.column];
      const bVal = b[sortConfig.column];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortConfig]);

  const handleSort = (column: string) => {
    setSortConfig(current => {
      if (current?.column === column) {
        return current.direction === 'asc' ? { column, direction: 'desc' } : null;
      }
      return { column, direction: 'asc' };
    });
  };

  const isCurrencyColumn = (col: string) => {
    const lower = col.toLowerCase();
    return ['amount', 'total', 'revenue', 'balance', 'price', 'outstanding', 'current', 'days'].some(term => lower.includes(term));
  };

  const formatValue = (value: unknown, column: string): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (isCurrencyColumn(column)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
      }
      return value.toLocaleString();
    }
    return String(value);
  };

  const getCellAlignment = (column: string, value: unknown): string => {
    if (typeof value === 'number' || isCurrencyColumn(column)) return 'text-right';
    return 'text-left';
  };

  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-full text-content-tertiary text-sm">No data</div>;
  }

  return (
    <div className={`flex flex-col bg-surface-primary ${fullHeight ? 'h-full' : ''}`}>
      {/* Title & Subtitle */}
      {(title || subtitle) && (
        <div className="flex-shrink-0 bg-surface-elevated border-b border-border px-4 py-3">
          {title && (
            <h2 className="text-lg font-bold text-content-primary">{title}</h2>
          )}
          {subtitle && (
            <p className="text-sm text-content-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
      )}

      {/* Summary Bar */}
      {data.summary && (data.summary.total !== undefined || data.summary.total_outstanding !== undefined || data.summary.buckets) && (
        <div className="flex-shrink-0 bg-surface-tertiary border-b border-border px-3 py-1.5 flex items-center gap-6 text-xs overflow-x-auto">
          {data.summary.total_outstanding !== undefined && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-content-tertiary">Outstanding:</span>
              <span className="font-semibold text-warning">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.summary.total_outstanding)}</span>
            </div>
          )}
          {data.summary.total !== undefined && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-content-tertiary">Total:</span>
              <span className="font-semibold text-content-primary">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.summary.total)}</span>
            </div>
          )}
          {data.summary.buckets && Object.entries(data.summary.buckets).map(([bucket, amount]) => (
            <div key={bucket} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-content-tertiary capitalize">{bucket.replace(/_/g, ' ')}:</span>
              <span className="font-medium text-content-secondary">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className={`flex-1 overflow-auto ${fullHeight ? '' : ''}`} style={fullHeight ? undefined : { maxHeight }}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-8 min-w-[32px] px-1 py-1 text-center text-[10px] font-medium text-content-tertiary border-b border-r border-border bg-surface-secondary sticky left-0 z-20">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-2 py-1 text-left text-[10px] font-semibold text-content-secondary border-b border-r border-border bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    <span className="uppercase tracking-wide">{col.replace(/_/g, ' ')}</span>
                    {sortConfig?.column === col && (
                      <svg className={`w-2.5 h-2.5 text-accent ${sortConfig.direction === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIdx) => (
              <tr key={rowIdx} className={`${rowIdx % 2 === 0 ? 'bg-surface-primary' : 'bg-surface-secondary/30'} hover:bg-accent-subtle/40 transition-colors`}>
                <td className="px-1 py-0.5 text-center text-[10px] text-content-tertiary border-r border-b border-border bg-surface-tertiary/30 sticky left-0 font-mono">
                  {rowIdx + 1}
                </td>
                {columns.map((col, colIdx) => {
                  const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                  const value = row[col];
                  return (
                    <td
                      key={col}
                      onClick={() => setSelectedCell({ row: rowIdx, col: colIdx })}
                      className={`px-2 py-0.5 border-r border-b border-border cursor-cell whitespace-nowrap ${getCellAlignment(col, value)} ${
                        isSelected ? 'bg-accent-subtle ring-1 ring-accent ring-inset' : ''
                      }`}
                    >
                      <span className={`${typeof value === 'number' && value < 0 ? 'text-error' : 'text-content-primary'} font-mono`}>
                        {formatValue(value, col)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 bg-surface-secondary border-t border-border px-3 py-1 flex items-center justify-between text-[10px] text-content-tertiary">
        <span>{rows.length} rows</span>
        <div className="flex items-center gap-3">
          {onDownload && (
            <button
              onClick={onDownload}
              className="px-2 py-0.5 rounded bg-surface-tertiary hover:bg-surface-primary text-content-secondary hover:text-content-primary transition-colors"
            >
              {downloadLabel}
            </button>
          )}
          {selectedCell && (
            <span className="font-mono">{String.fromCharCode(65 + selectedCell.col)}{selectedCell.row + 1}</span>
          )}
        </div>
      </div>
    </div>
  );
}
