import Badge from './Badge';
import Card from './Card';

interface LineageNodeCardProps {
  title: string;
  type: 'source' | 'ingestion' | 'model' | 'consumer';
  owner?: string;
  sla?: string;
  qualityScore?: number;
}

const typeVariant = {
  source: 'neutral',
  ingestion: 'warning',
  model: 'accent',
  consumer: 'success',
} as const;

export function LineageNodeCard({ title, type, owner, sla, qualityScore }: LineageNodeCardProps) {
  return (
    <Card variant="elevated" className="p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
        <Badge variant={typeVariant[type]}>{type}</Badge>
      </div>
      <div className="mt-2 space-y-1 text-xs text-content-secondary">
        {owner ? <p>Owner: {owner}</p> : null}
        {sla ? <p>SLA: {sla}</p> : null}
        {qualityScore !== undefined ? <p>Quality: {qualityScore}%</p> : null}
      </div>
    </Card>
  );
}

export function LineageEdgeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
      <Badge variant="neutral">Batch</Badge>
      <Badge variant="warning">Streaming</Badge>
      <Badge variant="error">Broken</Badge>
    </div>
  );
}
