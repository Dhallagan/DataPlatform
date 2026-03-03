'use client';

import { useEffect, useRef, useState } from 'react';
import { MetricContract } from '@/lib/metricGlossary';

interface MetricHelpButtonProps {
  contract: MetricContract | null;
}

export default function MetricHelpButton({ contract }: MetricHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  if (!contract) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-5 h-5 rounded-full border border-border bg-surface-primary text-content-tertiary hover:text-content-primary hover:bg-surface-tertiary text-xs font-semibold"
        aria-label={`Metric help for ${contract.title}`}
        title="Metric help"
      >
        ?
      </button>
      {open && (
        <div className="absolute right-0 mt-2 z-30 w-[360px] max-w-[90vw] bg-surface-elevated border border-border rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-content-primary">{contract.title}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
              contract.status === 'governed'
                ? 'bg-success-muted text-success'
                : contract.status === 'deprecated'
                  ? 'bg-error-muted text-error'
                  : 'bg-warning-muted text-warning'
            }`}>
              {contract.status}
            </span>
          </div>
          <div>
            <p className="text-[11px] text-content-tertiary">Definition</p>
            <p className="text-xs text-content-primary">{contract.definition}</p>
          </div>
          <div>
            <p className="text-[11px] text-content-tertiary">Formula</p>
            <p className="text-xs text-content-primary font-mono">{contract.formula}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[11px] text-content-tertiary">Grain</p>
              <p className="text-content-primary">{contract.grain}</p>
            </div>
            <div>
              <p className="text-[11px] text-content-tertiary">Owner</p>
              <p className="text-content-primary">{contract.owner}</p>
            </div>
            <div>
              <p className="text-[11px] text-content-tertiary">SLA</p>
              <p className="text-content-primary">{contract.sla}</p>
            </div>
            <div>
              <p className="text-[11px] text-content-tertiary">Tests</p>
              <p className="text-content-primary">{contract.hasTests ? 'Yes' : 'No'}</p>
            </div>
          </div>
          <div>
            <p className="text-[11px] text-content-tertiary">Source of Truth</p>
            <p className="text-xs text-content-primary font-mono">{contract.sourceOfTruth.join(', ')}</p>
          </div>
          <div>
            <p className="text-[11px] text-content-tertiary">Instrumentation</p>
            <p className="text-xs text-content-primary">{contract.instrumentation}</p>
          </div>
          <a
            href={`/docs/metrics-layer#${contract.key}`}
            className="inline-flex text-xs text-accent hover:underline"
          >
            Open full contract
          </a>
        </div>
      )}
    </div>
  );
}
