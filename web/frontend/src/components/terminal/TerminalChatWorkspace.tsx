'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ChatPanel from '@/components/ChatPanel';
import ResultsPanel from '@/components/ResultsPanel';
import { Message } from '@/lib/api';
import { QueryResult } from '@/lib/chatTypes';

interface TerminalChatWorkspaceProps {
  pageTitle: string;
  compactHeader?: boolean;
}

interface StoredQueryResult {
  sql?: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  result: QueryResult['result'];
  timestamp: string;
}

interface StoredTerminalChatState {
  messages: Message[];
  currentResult: StoredQueryResult | null;
  resultHistory: StoredQueryResult[];
}

const STORAGE_KEY = 'basedhoc_terminal_chat_state_v1';

function toStoredResult(result: QueryResult): StoredQueryResult {
  return {
    sql: result.sql,
    toolName: result.toolName,
    toolArgs: result.toolArgs,
    result: result.result,
    timestamp: result.timestamp.toISOString(),
  };
}

function fromStoredResult(result: StoredQueryResult): QueryResult {
  return {
    sql: result.sql,
    toolName: result.toolName,
    toolArgs: result.toolArgs,
    result: result.result,
    timestamp: new Date(result.timestamp),
  };
}

export default function TerminalChatWorkspace({ pageTitle, compactHeader = false }: TerminalChatWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null);
  const [resultHistory, setResultHistory] = useState<QueryResult[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as StoredTerminalChatState;
      setMessages(Array.isArray(parsed.messages) ? parsed.messages : []);
      setCurrentResult(parsed.currentResult ? fromStoredResult(parsed.currentResult) : null);
      setResultHistory(Array.isArray(parsed.resultHistory) ? parsed.resultHistory.map(fromStoredResult) : []);
    } catch (error) {
      console.error('Failed to restore terminal chat state', error);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const payload: StoredTerminalChatState = {
      messages,
      currentResult: currentResult ? toStoredResult(currentResult) : null,
      resultHistory: resultHistory.map(toStoredResult),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [currentResult, isHydrated, messages, resultHistory]);

  const handleNewResult = (result: QueryResult) => {
    setCurrentResult(result);
    setResultHistory((prev) => [result, ...prev]);
  };

  const seedPrompt = () => {
    window.dispatchEvent(
      new CustomEvent('insertPrompt', {
        detail: {
          prompt: `Summarize the ${pageTitle} page and tell me the highest-priority actions based on the visible metrics.`,
        },
      }),
    );
  };

  const clearWorkspace = () => {
    setMessages([]);
    setCurrentResult(null);
    setResultHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-secondary px-4 py-3">
        {!compactHeader ? (
          <div>
            <p className="text-sm font-semibold text-content-primary">Terminal Chat</p>
            <p className="text-xs text-content-tertiary">Ask questions without leaving {pageTitle}.</p>
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={seedPrompt}
            className="rounded border border-border bg-surface-primary px-3 py-1.5 text-xs font-medium text-content-primary hover:bg-surface-tertiary"
          >
            Summarize Page
          </button>
          <button
            type="button"
            onClick={clearWorkspace}
            className="rounded border border-border bg-surface-primary px-3 py-1.5 text-xs font-medium text-content-primary hover:bg-surface-tertiary"
          >
            Clear
          </button>
          <Link
            href="/chat"
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Open Full Chat
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <ChatPanel messages={messages} setMessages={setMessages} onNewResult={handleNewResult} />
        <ResultsPanel
          currentResult={currentResult}
          resultHistory={resultHistory}
          onSelectResult={setCurrentResult}
          className="w-full border-t border-border xl:w-[400px] xl:border-l xl:border-t-0"
        />
      </div>
    </div>
  );
}
