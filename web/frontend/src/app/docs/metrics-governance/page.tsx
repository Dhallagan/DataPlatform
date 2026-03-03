'use client';

import DocMeta from '@/components/DocMeta';

export default function MetricsGovernancePage() {
  return (
    <main className="max-w-6xl space-y-4">
      <section className="bg-surface-elevated border border-border rounded-lg p-5">
        <h1 className="text-lg font-semibold text-content-primary">Metrics Governance</h1>
        <p className="text-sm text-content-secondary mt-1">
          Ownership model for definitions, instrumentation standards, certification, and change control.
        </p>
        <DocMeta
          owner="Data Platform"
          reviewers="Growth/Product/Finance/Ops Leads"
          lastReviewedOn="2026-03-02"
          reviewCadence="Biweekly"
        />
      </section>

      <section id="trust-tiers-and-certification" className="bg-surface-elevated border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold text-content-primary">Trust Tiers and Certification</h2>
        <div className="overflow-auto border border-border rounded">
          <table className="w-full text-xs">
            <thead className="bg-surface-primary">
              <tr>
                <th className="text-left px-3 py-2 border-b border-border">Tier</th>
                <th className="text-left px-3 py-2 border-b border-border">Use Case</th>
                <th className="text-left px-3 py-2 border-b border-border">Requirements</th>
              </tr>
            </thead>
            <tbody>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">Certified</td>
                <td className="px-3 py-2 border-t border-border">Exec reporting, planning, compensation</td>
                <td className="px-3 py-2 border-t border-border">Owner + approver + tests + SLOs + runbook</td>
              </tr>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">Provisional</td>
                <td className="px-3 py-2 border-t border-border">Exploration and iteration</td>
                <td className="px-3 py-2 border-t border-border">Draft contract with owner and source mapping</td>
              </tr>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">Review Required</td>
                <td className="px-3 py-2 border-t border-border">Blocked from strategic decisions</td>
                <td className="px-3 py-2 border-t border-border">Missing tests or unresolved reliability issues</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="metric-change-workflow" className="bg-surface-elevated border border-border rounded-lg p-5 space-y-2">
        <h2 className="text-base font-semibold text-content-primary">Metric Change Workflow</h2>
        <ol className="list-decimal pl-5 text-sm text-content-secondary space-y-1">
          <li>Open a contract change proposal with reason, impact, and migration plan.</li>
          <li>Review with domain owner and Data Platform approver.</li>
          <li>Validate with tests in staging and monitor for one full refresh cycle.</li>
          <li>Publish changelog and update any downstream dashboard/report references.</li>
        </ol>
      </section>

      <section className="bg-surface-elevated border border-border rounded-lg p-5 space-y-2">
        <h2 className="text-base font-semibold text-content-primary">Cross-Functional Operating Model</h2>
        <ul className="list-disc pl-5 text-sm text-content-secondary space-y-1">
          <li>Growth/Product/Ops/Finance own business intent and acceptance criteria.</li>
          <li>Engineering owns collection integrity and event emission reliability.</li>
          <li>Data Platform owns contract enforcement, trust scoring, and release policy.</li>
        </ul>
      </section>
    </main>
  );
}
