import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
}

export default function PageHeader({ title, subtitle, actions, filters }: PageHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-content-primary">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-content-secondary">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
    </header>
  );
}
