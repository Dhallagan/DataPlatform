'use client';

import TerminalChatWorkspace from '@/components/terminal/TerminalChatWorkspace';
import TerminalShell from '@/components/terminal/TerminalShell';

export default function TerminalChatPage() {
  return (
    <TerminalShell
      active="chat"
      title="Terminal Chat"
      subtitle="Ask questions about the warehouse without leaving the terminal."
    >
      <div className="h-[calc(100vh-7.5rem)] min-h-[640px] overflow-hidden rounded border border-border bg-surface-elevated">
        <TerminalChatWorkspace pageTitle="Terminal" compactHeader />
      </div>
    </TerminalShell>
  );
}
