'use client';

interface DocMetaProps {
  owner: string;
  reviewers: string;
  lastReviewedOn: string;
  reviewCadence: string;
}

export default function DocMeta({ owner, reviewers, lastReviewedOn, reviewCadence }: DocMetaProps) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-content-tertiary md:grid-cols-4">
      <div className="rounded border border-border bg-surface-primary px-2 py-1.5">
        <span className="text-content-secondary">Owner:</span> {owner}
      </div>
      <div className="rounded border border-border bg-surface-primary px-2 py-1.5">
        <span className="text-content-secondary">Reviewers:</span> {reviewers}
      </div>
      <div className="rounded border border-border bg-surface-primary px-2 py-1.5">
        <span className="text-content-secondary">Last reviewed:</span> {lastReviewedOn}
      </div>
      <div className="rounded border border-border bg-surface-primary px-2 py-1.5">
        <span className="text-content-secondary">Cadence:</span> {reviewCadence}
      </div>
    </div>
  );
}
