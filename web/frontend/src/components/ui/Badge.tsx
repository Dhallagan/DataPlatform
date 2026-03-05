import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'accent';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-tertiary text-content-secondary border border-border',
  success: 'bg-success-muted text-success border border-success/20',
  warning: 'bg-warning-muted text-warning border border-warning/20',
  error: 'bg-error-muted text-error border border-error/20',
  accent: 'bg-accent-muted text-accent border border-accent/20',
};

export default function Badge({ className, variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', variantClasses[variant], className)}
      {...props}
    />
  );
}
