export interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  result: unknown;
}

export interface ChatResponse {
  message: string;
  conversation_id: string;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
  data?: Record<string, unknown>;
}

export async function sendMessage(
  message: string,
  history: Message[],
  conversationId?: string
): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      history: history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to send message');
  }

  return response.json();
}

export async function getSchema(): Promise<Record<string, unknown>> {
  const response = await fetch('/api/schema');

  if (!response.ok) {
    throw new Error('Failed to fetch schema');
  }

  return response.json();
}

export interface MonitoringTableStat {
  table: string;
  schema: string;
  freshness_column: string;
  freshest_at: string | null;
  row_count: number;
}

export interface SchemaDriftChange {
  table: string;
  added_columns: string[];
  removed_columns: string[];
  changed_columns: {
    column: string;
    baseline_type: string;
    current_type: string;
    baseline_nullable: boolean;
    current_nullable: boolean;
  }[];
}

export interface SchemaDrift {
  baseline_exists: boolean;
  baseline_generated_at: string | null;
  added_tables: string[];
  removed_tables: string[];
  changed_tables: SchemaDriftChange[];
}

export interface MonitoringOverview {
  generated_at: string;
  tables: MonitoringTableStat[];
  by_schema: Record<string, { table_count: number; freshest_at: string | null; stale_tables: number }>;
  schema_summary: { table_count: number; column_count: number };
  schema_drift: SchemaDrift;
}

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
  const response = await fetch('/api/monitoring/overview');
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Failed to fetch monitoring overview');
  }
  const payload = await response.json();
  return payload.overview as MonitoringOverview;
}

export async function saveSchemaBaseline(): Promise<void> {
  const response = await fetch('/api/monitoring/schema-baseline', {
    method: 'POST',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || 'Failed to save schema baseline');
  }
}

// Streaming event types
export interface StreamEvent {
  type: 'thinking' | 'text' | 'tool_start' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;
  name?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
  error?: string;
}

export async function* sendMessageStream(
  message: string,
  history: Message[],
  abortSignal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history: history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
    signal: abortSignal,
  });

  if (!response.ok) {
    throw new Error('Failed to connect to stream');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            yield data as StreamEvent;
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
