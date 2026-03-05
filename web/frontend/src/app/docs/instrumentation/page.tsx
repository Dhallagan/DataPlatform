'use client';

import DocMeta from '@/components/DocMeta';

export default function InstrumentationPage() {
  return (
    <main className="max-w-6xl space-y-4">
      <section className="bg-surface-elevated border border-border rounded-lg p-5">
        <h1 className="text-lg font-semibold text-content-primary">Instrumentation Standards</h1>
        <p className="text-sm text-content-secondary mt-1">
          Event and action standards to support reliable metrics and future agentic workflows.
        </p>
        <DocMeta
          owner="Engineering + Data Platform"
          reviewers="Product Analytics, Growth Analytics"
          lastReviewedOn="2026-03-02"
          reviewCadence="Monthly"
        />
      </section>

      <section id="identity-and-event-standards" className="bg-surface-elevated border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold text-content-primary">Identity and Event Standards</h2>
        <ul className="list-disc pl-5 text-sm text-content-secondary space-y-1">
          <li>Every event must include: <code className="font-mono">event_id</code>, <code className="font-mono">event_time</code>, <code className="font-mono">organization_id</code>, <code className="font-mono">user_id</code> (nullable), <code className="font-mono">session_id</code> (nullable).</li>
          <li>Event names follow: <code className="font-mono">domain.object.action</code> (example: <code className="font-mono">gtm.lead.created</code>).</li>
          <li>All enums must be documented and validated in dbt accepted-values tests.</li>
        </ul>
      </section>

      <section id="event-taxonomy-for-agentic-workflows" className="bg-surface-elevated border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold text-content-primary">Event Taxonomy for Agentic Workflows</h2>
        <p className="text-sm text-content-secondary">
          Agent workflows run on typed contracts. Every actionable signal must map to a deterministic action interface.
        </p>
        <pre className="p-3 rounded bg-surface-primary border border-border text-xs overflow-auto text-content-secondary">{`{
  "signal": "gtm.trial_conversion_risk",
  "required_fields": ["organization_id", "signal_score", "recommended_channel"],
  "allowed_actions": ["send_first_reachout", "queue_11labs_call", "assign_sdr_followup"],
  "safety_policy": {
    "human_approval_required_above_score": 0.92,
    "max_actions_per_org_per_day": 2
  }
}`}</pre>
      </section>

      <section className="bg-surface-elevated border border-border rounded-lg p-5 space-y-2">
        <h2 className="text-base font-semibold text-content-primary">Versioning and Deprecation</h2>
        <ul className="list-disc pl-5 text-sm text-content-secondary space-y-1">
          <li>Breaking schema changes require version bump (<code className="font-mono">v1</code> to <code className="font-mono">v2</code>).</li>
          <li>Maintain dual-write compatibility for one release window before removing old fields.</li>
          <li>Document replacement contract and migration status in metrics governance docs.</li>
        </ul>
      </section>
    </main>
  );
}
