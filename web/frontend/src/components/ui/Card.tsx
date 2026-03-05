import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type CardVariant = 'default' | 'elevated' | 'interactive';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-surface-primary border border-border',
  elevated: 'bg-surface-elevated border border-border shadow-soft',
  interactive: 'bg-surface-elevated border border-border shadow-soft hover:shadow-medium hover:border-accent transition-all cursor-pointer',
};

export default function Card({ className, variant = 'default', ...props }: CardProps) {
  return <div className={cn('rounded-xl', variantClasses[variant], className)} {...props} />;
}
