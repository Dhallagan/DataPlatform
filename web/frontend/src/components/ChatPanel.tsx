'use client';

import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { sendMessage, Message } from '@/lib/api';
import { QueryResult } from '@/app/page';

interface ChatPanelProps {
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  onNewResult: (result: QueryResult) => void;
}

export default function ChatPanel({ messages, setMessages, onNewResult }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleInsertPrompt = (e: CustomEvent<{ prompt: string }>) => {
      setInput(e.detail.prompt);
      inputRef.current?.focus();
    };

    window.addEventListener('insertPrompt', handleInsertPrompt as EventListener);
    return () => window.removeEventListener('insertPrompt', handleInsertPrompt as EventListener);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const messagesWithUser = [...messages, userMessage];
    setMessages(messagesWithUser);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendMessage(userMessage.content, messages || []);

      // Add tool results to the results panel
      if (response.tool_results) {
        for (const tr of response.tool_results) {
          const toolCall = response.tool_calls?.find(tc => tc.name === tr.tool);
          const result = {
            toolName: tr.tool,
            toolArgs: toolCall?.args || {},
            result: tr.result,
            timestamp: new Date(),
            sql: tr.tool === 'execute_query' && toolCall?.args?.sql ? toolCall.args.sql as string : undefined,
          };
          onNewResult(result);
        }
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message,
        toolCalls: response.tool_calls || undefined,
        toolResults: response.tool_results || undefined,
      };
      setMessages([...messagesWithUser, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      };
      setMessages([...messagesWithUser, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface-primary min-w-0">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        {(!messages || messages.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-content-primary mb-2">
              How can I help?
            </h2>
            <p className="text-content-secondary text-[15px] leading-relaxed">
              Ask me about your BrowserBase data — session metrics, MRR, cohort retention, or run custom queries against the warehouse.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {(messages || []).map((message, idx) => (
              <MessageBubble key={idx} message={message} />
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start animate-slide-up">
                <div className="rounded-2xl px-4 py-3 bg-surface-elevated border border-border shadow-soft">
                  <div className="flex items-center gap-2 text-content-tertiary">
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-surface-elevated p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your data..."
              className="flex-1 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl
                         text-content-primary placeholder-content-tertiary text-[15px]
                         focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                         transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover active:bg-accent-active text-white rounded-xl
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors text-[15px] font-medium"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
