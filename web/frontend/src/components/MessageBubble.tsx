'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/lib/api';
import ThinkingBlock from './ThinkingBlock';
import ReportCard from './ReportCard';

interface MessageBubbleProps {
  message: Message;
  compact?: boolean;
}

export default function MessageBubble({ message, compact = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  // Match tool calls with their results
  const getToolPairs = () => {
    if (!message.toolCalls || !message.toolResults) return [];
    return message.toolCalls.map((tc, idx) => ({
      toolCall: tc,
      toolResult: message.toolResults![idx],
    })).filter(pair => pair.toolResult);
  };

  const toolPairs = getToolPairs();
  const hasReportResults = toolPairs.some(p => {
    const data = p.toolResult.result as { data?: unknown[]; success?: boolean };
    return data?.data && Array.isArray(data.data) && data.data.length > 0;
  });

  // Check for schema results (different display)
  const schemaResult = message.toolResults?.find(r => r.tool === 'introspect_schema');

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div
        className={`${isUser ? 'max-w-[85%]' : 'max-w-full w-full'} rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-elevated border border-border shadow-soft'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-[15px]">{message.content}</p>
        ) : (
          <div className="space-y-3">
            {/* Thinking block - collapsed tool call details */}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <ThinkingBlock
                toolCalls={message.toolCalls}
                toolResults={message.toolResults}
              />
            )}

            {/* AI Analysis text */}
            {message.content && (
              <div className="markdown-content text-content-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            )}

            {/* Report Cards - clickable, with preview and download */}
            {!compact && toolPairs.length > 0 && (
              <div className="space-y-3 pt-2">
                {toolPairs.map((pair, idx) => {
                  const data = pair.toolResult.result as { data?: unknown[]; success?: boolean };
                  // Only show ReportCard for results with data or schema
                  if (pair.toolResult.tool === 'introspect_schema' ||
                      (data?.data && Array.isArray(data.data) && data.data.length > 0)) {
                    return (
                      <ReportCard
                        key={idx}
                        toolCall={pair.toolCall}
                        toolResult={pair.toolResult}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            )}

            {/* Schema display (special case - not a table) */}
            {!compact && schemaResult && (
              <SchemaDisplay result={schemaResult.result as Record<string, { name: string; type: string }[]>} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SchemaDisplay({ result }: { result: Record<string, { name: string; type: string }[]> }) {
  if (!result || typeof result !== 'object') return null;

  // Filter out non-table entries
  const tables = Object.entries(result).filter(([_, cols]) => Array.isArray(cols));
  if (tables.length === 0) return null;

  return (
    <div className="bg-surface-tertiary/50 rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 bg-surface-secondary border-b border-border flex items-center gap-2">
        <span>🗄️</span>
        <span className="text-sm font-semibold text-content-primary">Database Schema</span>
        <span className="text-xs text-content-tertiary">{tables.length} tables</span>
      </div>
      <div className="p-3 space-y-2 max-h-[200px] overflow-auto">
        {tables.map(([table, columns]) => (
          <div key={table} className="flex items-start gap-2">
            <span className="text-xs font-semibold text-content-primary min-w-[100px]">{table}</span>
            <div className="flex flex-wrap gap-1">
              {columns.slice(0, 6).map((col) => (
                <span key={col.name} className="text-[10px] bg-surface-secondary px-1.5 py-0.5 rounded font-mono text-content-secondary">
                  {col.name}
                </span>
              ))}
              {columns.length > 6 && (
                <span className="text-[10px] text-content-tertiary">+{columns.length - 6} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
