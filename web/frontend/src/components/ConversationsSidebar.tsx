'use client';

import { Conversation } from '@/app/page';

interface ConversationsSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewConversation: () => void;
}

export default function ConversationsSidebar({
  conversations,
  activeId,
  onSelect,
  onNewConversation,
}: ConversationsSidebarProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="w-64 bg-surface-secondary border-r border-border flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New conversation
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-content-tertiary">No conversations yet</p>
          </div>
        ) : (
          <div className="py-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`w-full text-left px-3 py-2.5 transition-colors ${
                  activeId === conversation.id
                    ? 'bg-accent-subtle border-l-2 border-accent'
                    : 'hover:bg-surface-tertiary border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-content-primary truncate">
                      {conversation.title}
                    </div>
                    {conversation.preview && (
                      <div className="text-xs text-content-tertiary truncate mt-0.5">
                        {conversation.preview}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-content-tertiary flex-shrink-0">
                    {formatTime(conversation.timestamp)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
