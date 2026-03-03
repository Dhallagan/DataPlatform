'use client';

import { useState } from 'react';
import { QueryResult } from '@/app/page';

interface ResultsPanelProps {
  currentResult: QueryResult | null;
  resultHistory: QueryResult[];
  onSelectResult: (result: QueryResult) => void;
}

interface ReportData {
  success?: boolean;
  data?: Record<string, unknown>[];
  columns?: string[];
  total?: number;
  total_outstanding?: number;
  summary?: Record<string, number>;
  error?: string;
  row_count?: number;
  count?: number;
}

export default function ResultsPanel({
  currentResult,
  resultHistory,
  onSelectResult,
}: ResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<'results' | 'query' | 'history'>('results');

  const formatValue = (value: unknown, column: string): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      const isMonetary = ['amount', 'total', 'revenue', 'balance', 'price', 'subtotal'].some(
        (term) => column.toLowerCase().includes(term)
      );
      if (isMonetary) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value);
      }
      return value.toLocaleString();
    }
    return String(value);
  };

  const getToolDisplayName = (toolName: string): string => {
    const names: Record<string, string> = {
      revenue_report: 'Revenue Report',
      aging_report: 'AR Aging',
      invoice_lookup: 'Invoice Lookup',
      introspect_schema: 'Schema',
      execute_query: 'Custom Query',
    };
    return names[toolName] || toolName;
  };

  const renderResults = () => {
    if (!currentResult) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <div className="w-12 h-12 bg-surface-tertiary rounded-xl flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125" />
            </svg>
          </div>
          <p className="text-content-tertiary text-sm">
            Results will appear here
          </p>
        </div>
      );
    }

    const data = currentResult.result as ReportData;

    // Handle schema introspection
    if (currentResult.toolName === 'introspect_schema') {
      const schema = currentResult.result as Record<string, { name: string; type: string }[]>;
      return (
        <div className="p-4 space-y-3">
          {Object.entries(schema).map(([table, columns]) => (
            <div key={table} className="bg-surface-elevated rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 bg-surface-tertiary border-b border-border">
                <span className="font-mono text-sm font-semibold text-accent">{table}</span>
              </div>
              <div className="p-3">
                <div className="flex flex-wrap gap-1.5">
                  {(columns as { name: string; type: string }[]).map((col) => (
                    <span
                      key={col.name}
                      className="inline-flex items-center px-2 py-1 rounded-lg text-xs bg-surface-tertiary"
                    >
                      <span className="text-content-primary font-mono">{col.name}</span>
                      <span className="text-content-tertiary ml-1.5 text-[10px]">{col.type}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Handle error
    if (data?.success === false || data?.error) {
      return (
        <div className="p-4">
          <div className="bg-error-muted border border-error/20 rounded-xl p-4">
            <p className="text-error text-sm">{data.error || 'Query failed'}</p>
          </div>
        </div>
      );
    }

    // Handle empty results
    if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) {
      return (
        <div className="p-4">
          <div className="bg-warning-muted border border-warning/20 rounded-xl p-4">
            <p className="text-warning text-sm">No results found</p>
          </div>
        </div>
      );
    }

    const columns = data.columns || Object.keys(data.data[0]);

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-tertiary sticky top-0">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-left font-medium text-content-secondary border-b border-border whitespace-nowrap text-xs"
                  >
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.data.map((row, idx) => (
                <tr key={idx} className="hover:bg-accent-subtle transition-colors">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-2.5 text-content-primary whitespace-nowrap font-mono text-xs"
                    >
                      {formatValue(row[col], col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex-shrink-0 border-t border-border bg-surface-tertiary px-4 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-content-tertiary">
              {data.row_count ?? data.count ?? data.data.length} rows
            </span>
            <div className="flex gap-4">
              {data.total !== undefined && (
                <span className="text-success font-medium">
                  Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.total)}
                </span>
              )}
              {data.total_outstanding !== undefined && (
                <span className="text-warning font-medium">
                  Outstanding: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.total_outstanding)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuery = () => {
    if (!currentResult) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <p className="text-content-tertiary text-sm">No query to display</p>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-4">
        <div>
          <h4 className="text-xs font-medium text-content-tertiary uppercase tracking-wide mb-2">Tool</h4>
          <div className="bg-surface-tertiary border border-border rounded-xl px-3 py-2 text-sm font-mono text-accent">
            {currentResult.toolName}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium text-content-tertiary uppercase tracking-wide mb-2">Parameters</h4>
          <pre className="bg-content-primary text-surface-primary rounded-xl p-3 text-xs overflow-x-auto font-mono">
            {JSON.stringify(currentResult.toolArgs, null, 2)}
          </pre>
        </div>

        {currentResult.sql && (
          <div>
            <h4 className="text-xs font-medium text-content-tertiary uppercase tracking-wide mb-2">Generated SQL</h4>
            <pre className="bg-content-primary text-success rounded-xl p-3 text-xs overflow-x-auto font-mono">
              {currentResult.sql}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => {
    if (resultHistory.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <p className="text-content-tertiary text-sm">No history yet</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-border">
        {resultHistory.map((result, idx) => (
          <button
            key={idx}
            onClick={() => onSelectResult(result)}
            className={`w-full text-left p-3 hover:bg-surface-tertiary transition-colors ${
              currentResult === result ? 'bg-accent-subtle border-l-2 border-accent' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-content-primary">
                {getToolDisplayName(result.toolName)}
              </span>
              <span className="text-[10px] text-content-tertiary font-mono">
                {result.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="text-xs text-content-tertiary truncate font-mono">
              {JSON.stringify(result.toolArgs)}
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="w-[400px] bg-surface-secondary border-l border-border flex flex-col flex-shrink-0">
      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {[
          { id: 'results', label: 'Results' },
          { id: 'query', label: 'Query' },
          { id: 'history', label: 'History', count: resultHistory.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-accent'
                : 'text-content-tertiary hover:text-content-secondary'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-surface-tertiary rounded text-[10px]">
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Header */}
      {currentResult && activeTab !== 'history' && (
        <div className="px-4 py-2.5 bg-surface-tertiary border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-content-primary">
              {getToolDisplayName(currentResult.toolName)}
            </span>
            <span className="text-[10px] text-content-tertiary font-mono">
              {currentResult.timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {activeTab === 'results' && renderResults()}
          {activeTab === 'query' && renderQuery()}
          {activeTab === 'history' && renderHistory()}
        </div>
      </div>
    </div>
  );
}
