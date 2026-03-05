import { ReactNode } from 'react';
import Button from './Button';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClassName?: string;
}

export default function Drawer({ open, onClose, title, children, widthClassName = 'w-full max-w-xl' }: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-content-primary/30 p-2 sm:p-4">
      <section className={`${widthClassName} flex h-full flex-col rounded-xl border border-border bg-surface-elevated shadow-medium`}>
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-base font-semibold text-content-primary">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </header>
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </section>
    </div>
  );
}
