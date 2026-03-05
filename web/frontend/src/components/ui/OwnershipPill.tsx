import Badge from './Badge';

interface OwnershipPillProps {
  owner: string;
  steward?: string;
}

export default function OwnershipPill({ owner, steward }: OwnershipPillProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="neutral">Owner: {owner}</Badge>
      {steward ? <Badge variant="accent">Steward: {steward}</Badge> : null}
    </div>
  );
}
