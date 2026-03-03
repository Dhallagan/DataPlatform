'use client';

import { useState } from 'react';
import { ToolCall, ToolResult } from '@/lib/api';

interface ThinkingBlockProps {
  toolCalls: ToolCall[];
  toolResults?: ToolResult[];
  defaultExpanded?: boolean;
}

export default function ThinkingBlock({ toolCalls, toolResults, defaultExpanded = false }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!toolCalls || toolCalls.length === 0) return null;

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'execute_query':
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
          </svg>
        );
      case 'introspect_schema':
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
        );
      case 'revenue_report':
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        );
      case 'aging_report':
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'invoice_lookup':
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
        );
    }
  };

  const formatArgValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return 'null';
    return JSON.stringify(value, null, 2);
  };

  const getResultStatus = (toolName: string): 'success' | 'error' | 'pending' => {
    if (!toolResults) return 'pending';
    const result = toolResults.find(r => r.tool === toolName);
    if (!result) return 'pending';
    const data = result.result as { success?: boolean; error?: string };
    if (data?.success === false || data?.error) return 'error';
    return 'success';
  };

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs text-content-tertiary hover:text-content-secondary transition-colors group"
      >
        <div className="flex items-center gap-1.5">
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
          <span className="font-medium">Thinking</span>
        </div>
        <span className="text-content-quaternary">
          {toolCalls.length} {toolCalls.length === 1 ? 'tool' : 'tools'} used
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2 animate-slide-up">
          {toolCalls.map((tc, idx) => {
            const status = getResultStatus(tc.name);
            const result = toolResults?.find(r => r.tool === tc.name);

            return (
              <div
                key={idx}
                className="bg-surface-tertiary/50 rounded-lg border border-border overflow-hidden"
              >
                {/* Tool header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-tertiary border-b border-border">
                  <div className={`p-1 rounded ${
                    status === 'success' ? 'bg-success/10 text-success' :
                    status === 'error' ? 'bg-error/10 text-error' :
                    'bg-accent/10 text-accent'
                  }`}>
                    {getToolIcon(tc.name)}
                  </div>
                  <span className="text-xs font-medium text-content-primary capitalize">
                    {tc.name.replace(/_/g, ' ')}
                  </span>
                  <div className={`ml-auto flex items-center gap-1 text-xs ${
                    status === 'success' ? 'text-success' :
                    status === 'error' ? 'text-error' :
                    'text-accent'
                  }`}>
                    {status === 'success' && (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>Success</span>
                      </>
                    )}
                    {status === 'error' && (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Error</span>
                      </>
                    )}
                    {status === 'pending' && (
                      <>
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        <span>Running</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Tool arguments */}
                {Object.keys(tc.args).length > 0 && (
                  <div className="px-3 py-2 border-b border-border">
                    <div className="text-[10px] uppercase tracking-wide text-content-tertiary mb-1.5">Arguments</div>
                    <div className="space-y-1">
                      {Object.entries(tc.args).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-xs text-content-tertiary font-mono shrink-0">{key}:</span>
                          <span className="text-xs text-content-secondary font-mono break-all">
                            {key === 'sql' ? (
                              <code className="bg-surface-secondary px-1.5 py-0.5 rounded text-accent">
                                {formatArgValue(value)}
                              </code>
                            ) : (
                              formatArgValue(value)
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Result preview */}
                {result && (
                  <div className="px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-content-tertiary mb-1.5">Result</div>
                    <div className="text-xs text-content-secondary">
                      {(() => {
                        const data = result.result as { data?: unknown[]; row_count?: number; count?: number; error?: string };
                        if (data?.error) {
                          return <span className="text-error">{data.error}</span>;
                        }
                        if (Array.isArray(data?.data)) {
                          return <span>{data.data.length} rows returned</span>;
                        }
                        if (data?.row_count !== undefined) {
                          return <span>{data.row_count} rows returned</span>;
                        }
                        if (data?.count !== undefined) {
                          return <span>{data.count} results</span>;
                        }
                        if (result.tool === 'introspect_schema') {
                          const tables = Object.keys(result.result as object);
                          return <span>{tables.length} tables found</span>;
                        }
                        return <span>Completed</span>;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
