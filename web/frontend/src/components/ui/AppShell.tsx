import { ReactNode } from 'react';
import Toolbar from '@/components/Toolbar';
import { cn } from '@/lib/cn';

interface AppShellProps {
  children: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

export default function AppShell({ children, sidebar, className }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-primary">
      <Toolbar />
      <div className={cn('mx-auto flex w-full max-w-[1440px] flex-1 gap-4 p-4', className)}>
        {sidebar ? <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside> : null}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
