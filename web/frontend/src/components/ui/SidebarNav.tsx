import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface SidebarNavItem {
  href: string;
  label: string;
  badge?: string;
  active?: boolean;
}

interface SidebarNavProps {
  title?: string;
  items: SidebarNavItem[];
}

export default function SidebarNav({ title, items }: SidebarNavProps) {
  return (
    <nav className="rounded-xl border border-border bg-surface-elevated p-3 shadow-soft">
      {title ? <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary">{title}</p> : null}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                'flex items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors',
                item.active
                  ? 'bg-accent text-white'
                  : 'text-content-secondary hover:bg-surface-tertiary hover:text-content-primary',
              )}
            >
              <span>{item.label}</span>
              {item.badge ? (
                <span className={cn('rounded px-1.5 py-0.5 text-xs', item.active ? 'bg-white/20 text-white' : 'bg-surface-secondary text-content-tertiary')}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
