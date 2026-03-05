import Card from './Card';
import { cn } from '@/lib/cn';

interface StatTileProps {
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

const trendClasses = {
  up: 'text-success',
  down: 'text-error',
  neutral: 'text-content-tertiary',
};

export default function StatTile({ label, value, delta, trend = 'neutral', className }: StatTileProps) {
  return (
    <Card variant="elevated" className={cn('p-4', className)}>
      <p className="text-xs uppercase tracking-wide text-content-tertiary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-content-primary">{value}</p>
      {delta ? <p className={cn('mt-2 text-xs font-medium', trendClasses[trend])}>{delta}</p> : null}
    </Card>
  );
}
