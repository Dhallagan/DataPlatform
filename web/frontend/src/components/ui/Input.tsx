import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-border bg-surface-secondary px-3 text-sm text-content-primary placeholder:text-content-tertiary',
        'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20',
        className,
      )}
      {...props}
    />
  );
});

export const SearchInput = forwardRef<HTMLInputElement, InputProps>(function SearchInput({ className, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.85-5.4a7.25 7.25 0 1 1-14.5 0 7.25 7.25 0 0 1 14.5 0Z" />
      </svg>
      <Input ref={ref} className="pl-9" {...props} />
    </div>
  );
});

export default Input;
