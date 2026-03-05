import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  key: string;
  label: string;
  badge?: string;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

function TabButton({ active = false, className, ...props }: TabButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-accent text-white'
          : 'text-content-secondary hover:text-content-primary hover:bg-surface-tertiary',
        className,
      )}
      {...props}
    />
  );
}

export default function Tabs({ items, activeKey, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {items.map((item) => (
        <TabButton key={item.key} active={item.key === activeKey} onClick={() => onChange(item.key)}>
          <span>{item.label}</span>
          {item.badge ? (
            <span className={cn('rounded px-1.5 py-0.5 text-xs', item.key === activeKey ? 'bg-white/20 text-white' : 'bg-surface-secondary text-content-tertiary')}>
              {item.badge}
            </span>
          ) : null}
        </TabButton>
      ))}
    </div>
  );
}
