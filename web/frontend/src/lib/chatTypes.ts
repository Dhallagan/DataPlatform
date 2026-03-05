import { Message, ToolResult } from '@/lib/api';

export interface QueryResult {
  sql?: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  result: ToolResult['result'];
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  messages: Message[];
}
