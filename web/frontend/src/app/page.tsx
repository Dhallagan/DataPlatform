'use client';

import { useState, useEffect } from 'react';
import Toolbar from '@/components/Toolbar';
import ConversationsSidebar from '@/components/ConversationsSidebar';
import ChatPanel from '@/components/ChatPanel';
import ResultsPanel from '@/components/ResultsPanel';
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

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null);
  const [resultHistory, setResultHistory] = useState<QueryResult[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('basedhoc_conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Restore dates
        const restored = parsed.map((c: Conversation) => ({
          ...c,
          timestamp: new Date(c.timestamp),
        }));
        setConversations(restored);
        // Restore last active conversation
        const lastActiveId = localStorage.getItem('basedhoc_active_conversation');
        if (lastActiveId) {
          const activeConv = restored.find((c: Conversation) => c.id === lastActiveId);
          if (activeConv) {
            setActiveConversationId(lastActiveId);
            setMessages(activeConv.messages || []);
          }
        }
      } catch (e) {
        console.error('Failed to parse saved conversations', e);
      }
    }
    setIsHydrated(true);
  }, []);

  // Save conversations to localStorage when they change
  useEffect(() => {
    if (isHydrated && conversations.length > 0) {
      localStorage.setItem('basedhoc_conversations', JSON.stringify(conversations));
    }
  }, [conversations, isHydrated]);

  // Save active conversation ID
  useEffect(() => {
    if (isHydrated && activeConversationId) {
      localStorage.setItem('basedhoc_active_conversation', activeConversationId);
    }
  }, [activeConversationId, isHydrated]);

  // Check for pending prompt from reports page
  useEffect(() => {
    const pendingPrompt = sessionStorage.getItem('pendingPrompt');
    if (pendingPrompt) {
      sessionStorage.removeItem('pendingPrompt');
      window.dispatchEvent(new CustomEvent('insertPrompt', {
        detail: { prompt: pendingPrompt }
      }));
    }
  }, []);

  const handleNewResult = (result: QueryResult) => {
    setCurrentResult(result);
    setResultHistory(prev => [result, ...prev]);
  };

  const handleNewConversation = () => {
    const newConversation: Conversation = {
      id: crypto.randomUUID(),
      title: 'New conversation',
      preview: '',
      timestamp: new Date(),
      messages: [],
    };
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setMessages([]);
    setCurrentResult(null);
    setResultHistory([]);
  };

  const handleSelectConversation = (id: string) => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setActiveConversationId(id);
      setMessages(conversation.messages || []);
    }
  };

  const handleMessagesChange = (newMessages: Message[]) => {
    setMessages(newMessages);
    if (activeConversationId) {
      setConversations(prev => prev.map(c =>
        c.id === activeConversationId
          ? {
              ...c,
              messages: newMessages,
              title: newMessages[0]?.content.slice(0, 40) || 'New conversation',
              preview: newMessages[newMessages.length - 1]?.content.slice(0, 60) || '',
            }
          : c
      ));
    } else if (newMessages.length > 0) {
      // Auto-create conversation on first message
      const newConversation: Conversation = {
        id: crypto.randomUUID(),
        title: newMessages[0].content.slice(0, 40),
        preview: newMessages[newMessages.length - 1]?.content.slice(0, 60) || '',
        timestamp: new Date(),
        messages: newMessages,
      };
      setConversations(prev => [newConversation, ...prev]);
      setActiveConversationId(newConversation.id);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-surface-primary">
      <Toolbar />

      <div className="flex-1 flex overflow-hidden">
        <ConversationsSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNewConversation={handleNewConversation}
        />

        <ChatPanel
          messages={messages}
          setMessages={handleMessagesChange}
          onNewResult={handleNewResult}
        />

        <ResultsPanel
          currentResult={currentResult}
          resultHistory={resultHistory}
          onSelectResult={setCurrentResult}
        />
      </div>
    </div>
  );
}
