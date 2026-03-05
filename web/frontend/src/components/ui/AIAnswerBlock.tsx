import Card from './Card';

export interface Citation {
  id: string;
  label: string;
}

interface AIAnswerBlockProps {
  answer: string;
  citations: Citation[];
  warning?: string;
}

export default function AIAnswerBlock({ answer, citations, warning }: AIAnswerBlockProps) {
  return (
    <Card variant="elevated" className="p-4">
      <p className="text-sm leading-relaxed text-content-primary whitespace-pre-wrap">{answer}</p>
      {warning ? (
        <div className="mt-3 rounded-lg border border-warning/20 bg-warning-muted px-3 py-2 text-xs text-warning">
          {warning}
        </div>
      ) : null}
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">Citations</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {citations.map((citation) => (
            <li key={citation.id} className="rounded bg-surface-tertiary px-2 py-1 text-xs text-content-secondary">
              {citation.label}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
