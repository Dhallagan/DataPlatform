import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T extends object> {
  columns: DataTableColumn<T>[];
  rows: T[];
  className?: string;
  emptyLabel?: string;
}

function alignClass(align?: 'left' | 'right' | 'center'): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

export default function DataTable<T extends object>({
  columns,
  rows,
  className,
  emptyLabel = 'No rows to display.',
}: DataTableProps<T>) {
  return (
    <div className={cn('overflow-auto rounded-xl border border-border bg-surface-elevated', className)}>
      <table className="w-full min-w-[640px] text-sm">
        <thead className="sticky top-0 bg-surface-secondary">
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} className={cn('border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-tertiary', alignClass(column.align))}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-content-tertiary">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-surface-primary even:bg-surface-secondary/30">
                {columns.map((column) => (
                  <td key={`${rowIndex}-${String(column.key)}`} className={cn('border-t border-border px-3 py-2 text-content-primary', alignClass(column.align))}>
                    {column.render ? column.render(row, rowIndex) : String((row as Record<string, unknown>)[String(column.key)] ?? '-')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
