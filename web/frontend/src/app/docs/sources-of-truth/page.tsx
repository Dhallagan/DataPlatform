'use client';

import DocMeta from '@/components/DocMeta';

export default function SourcesOfTruthPage() {
  return (
    <main className="max-w-6xl space-y-4">
      <section className="bg-surface-elevated border border-border rounded-lg p-5">
        <h1 className="text-lg font-semibold text-content-primary">Sources of Truth Registry</h1>
        <p className="text-sm text-content-secondary mt-1">
          Domain-level canonical data products and ownership to align Growth, Product, Engineering, Ops, and Finance.
        </p>
        <DocMeta
          owner="Data Platform"
          reviewers="Domain Owners"
          lastReviewedOn="2026-03-02"
          reviewCadence="Monthly"
        />
      </section>

      <section id="growth" className="bg-surface-elevated border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-content-primary mb-3">Growth</h2>
        <p className="text-sm text-content-secondary">Canonical models: <code className="font-mono">gtm.agg_funnel_daily</code>, <code className="font-mono">gtm.growth_task_queue</code></p>
        <p className="text-xs text-content-tertiary mt-1">Owner: Growth Analytics | Approver: Data Platform</p>
      </section>

      <section id="product" className="bg-surface-elevated border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-content-primary mb-3">Product</h2>
        <p className="text-sm text-content-secondary">Canonical models: <code className="font-mono">pro.agg_product_daily</code>, <code className="font-mono">pro.kpi_product</code></p>
        <p className="text-xs text-content-tertiary mt-1">Owner: Product Analytics | Approver: Data Platform</p>
      </section>

      <section id="finance" className="bg-surface-elevated border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-content-primary mb-3">Finance</h2>
        <p className="text-sm text-content-secondary">Canonical models: <code className="font-mono">fin.snap_mrr</code>, <code className="font-mono">fin.agg_revenue_monthly</code></p>
        <p className="text-xs text-content-tertiary mt-1">Owner: Finance Analytics | Approver: Finance Lead</p>
      </section>

      <section id="engineering-and-ops" className="bg-surface-elevated border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-content-primary mb-3">Engineering and Ops</h2>
        <p className="text-sm text-content-secondary">Canonical models: <code className="font-mono">eng.agg_engineering_daily</code>, <code className="font-mono">ops.kpi_ops</code></p>
        <p className="text-xs text-content-tertiary mt-1">Owner: Platform Ops | Approver: Engineering Manager</p>
      </section>

      <section className="bg-surface-elevated border border-border rounded-lg p-5">
        <h2 className="text-base font-semibold text-content-primary mb-3">RACI</h2>
        <div className="overflow-auto border border-border rounded">
          <table className="w-full text-xs">
            <thead className="bg-surface-primary">
              <tr>
                <th className="text-left px-3 py-2 border-b border-border">Area</th>
                <th className="text-left px-3 py-2 border-b border-border">Responsible</th>
                <th className="text-left px-3 py-2 border-b border-border">Accountable</th>
                <th className="text-left px-3 py-2 border-b border-border">Consulted</th>
              </tr>
            </thead>
            <tbody>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">Metric Definition</td>
                <td className="px-3 py-2 border-t border-border">Domain Analytics</td>
                <td className="px-3 py-2 border-t border-border">Data Platform</td>
                <td className="px-3 py-2 border-t border-border">Ops + Engineering</td>
              </tr>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">Instrumentation</td>
                <td className="px-3 py-2 border-t border-border">Engineering</td>
                <td className="px-3 py-2 border-t border-border">Product</td>
                <td className="px-3 py-2 border-t border-border">Data Platform</td>
              </tr>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">SLO and Incidents</td>
                <td className="px-3 py-2 border-t border-border">Data Platform</td>
                <td className="px-3 py-2 border-t border-border">Ops</td>
                <td className="px-3 py-2 border-t border-border">All domains</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
