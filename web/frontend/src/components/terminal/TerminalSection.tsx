'use client';

import { ReactNode } from 'react';
import { Badge, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

interface TerminalSectionProps {
  title: string;
  subtitle?: string;
  command?: string;
  children: ReactNode;
  className?: string;
}

interface TerminalDataStatusProps {
  freshnessLabel: string;
  coverageLabel: string;
  qualityLabel?: string;
}

export function TerminalDataStatus({ freshnessLabel, coverageLabel, qualityLabel }: TerminalDataStatusProps) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <div className="rounded border border-border bg-surface-primary px-3 py-2 text-xs">
        <p className="text-content-tertiary">Freshness</p>
        <p className="mt-1 font-medium text-content-primary">{freshnessLabel}</p>
      </div>
      <div className="rounded border border-border bg-surface-primary px-3 py-2 text-xs">
        <p className="text-content-tertiary">Coverage</p>
        <p className="mt-1 font-medium text-content-primary">{coverageLabel}</p>
      </div>
      <div className="rounded border border-border bg-surface-primary px-3 py-2 text-xs">
        <p className="text-content-tertiary">Quality</p>
        <p className="mt-1 font-medium text-content-primary">{qualityLabel || 'Baseline checks active'}</p>
      </div>
    </div>
  );
}

export default function TerminalSection({ title, subtitle, command, children, className }: TerminalSectionProps) {
  return (
    <Card variant="elevated" className={cn('p-4', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-content-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-content-secondary">{subtitle}</p> : null}
        </div>
        {command ? <Badge variant="neutral">{command}</Badge> : null}
      </div>
      {children}
    </Card>
  );
}
