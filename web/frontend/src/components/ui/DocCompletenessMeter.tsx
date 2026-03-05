import { cn } from '@/lib/cn';

interface DocCompletenessMeterProps {
  score: number;
  threshold?: number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function DocCompletenessMeter({ score, threshold = 80 }: DocCompletenessMeterProps) {
  const normalized = clamp(score);
  const passing = normalized >= threshold;

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Documentation Completeness</p>
        <span className={cn('text-sm font-semibold', passing ? 'text-success' : 'text-warning')}>{normalized}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-surface-tertiary">
        <div className={cn('h-full transition-all', passing ? 'bg-success' : 'bg-warning')} style={{ width: `${normalized}%` }} />
      </div>
      <p className="mt-2 text-xs text-content-tertiary">Threshold: {threshold}%</p>
    </div>
  );
}
