import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-surface-secondary px-3 text-sm text-content-primary',
        'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export default Select;
