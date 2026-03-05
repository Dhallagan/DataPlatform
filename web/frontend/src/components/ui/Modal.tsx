import { ReactNode } from 'react';
import Button from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
}

export default function Modal({ open, onClose, title, children, primaryActionLabel, onPrimaryAction }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-content-primary/30 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-surface-elevated shadow-medium">
        <header className="border-b border-border p-4">
          <h2 className="text-base font-semibold text-content-primary">{title}</h2>
        </header>
        <div className="p-4">{children}</div>
        <footer className="flex justify-end gap-2 border-t border-border p-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          {primaryActionLabel && onPrimaryAction ? (
            <Button onClick={onPrimaryAction}>{primaryActionLabel}</Button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
