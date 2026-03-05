import Button from './Button';

interface StateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

function StateFrame({ title, description, actionLabel, onAction }: StateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-secondary p-8 text-center">
      <h3 className="text-base font-semibold text-content-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-content-secondary">{description}</p>
      {actionLabel && onAction ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState(props: StateProps) {
  return <StateFrame {...props} />;
}

export function ErrorState(props: StateProps) {
  return <StateFrame {...props} />;
}

export function LoadingState({ title = 'Loading', description = 'Please wait while data loads.' }: { title?: string; description?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-8">
      <div className="mx-auto flex w-fit items-center gap-2 text-content-secondary">
        <div className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
        <div className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: '150ms' }} />
        <div className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: '300ms' }} />
      </div>
      <p className="mt-3 text-center text-sm font-medium text-content-primary">{title}</p>
      <p className="mt-1 text-center text-xs text-content-tertiary">{description}</p>
    </div>
  );
}
