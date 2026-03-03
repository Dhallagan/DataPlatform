'use client';

export default function StandardsPage() {
  return (
    <main className="max-w-6xl space-y-4">
      <section className="bg-surface-elevated border border-border rounded-lg p-5">
        <h1 className="text-lg font-semibold text-content-primary">Data Standards</h1>
        <p className="text-sm text-content-secondary mt-1">
          Standards for data quality, reliability, and documentation across Growth, Product, Engineering, Ops, and Finance.
        </p>
      </section>

      <section id="data-quality-and-reliability-slos" className="bg-surface-elevated border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-base font-semibold text-content-primary">Data Quality and Reliability SLOs</h2>
        <div className="overflow-auto border border-border rounded">
          <table className="w-full text-xs">
            <thead className="bg-surface-primary">
              <tr>
                <th className="text-left px-3 py-2 border-b border-border">Standard</th>
                <th className="text-left px-3 py-2 border-b border-border">Target</th>
                <th className="text-left px-3 py-2 border-b border-border">Enforcement</th>
              </tr>
            </thead>
            <tbody>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">Freshness</td>
                <td className="px-3 py-2 border-t border-border">Daily marts complete by 08:00 UTC</td>
                <td className="px-3 py-2 border-t border-border">Pipeline freshness monitor + alert</td>
              </tr>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">Null Threshold</td>
                <td className="px-3 py-2 border-t border-border">&lt; 0.1% on required metric fields</td>
                <td className="px-3 py-2 border-t border-border">dbt test gate on deploy</td>
              </tr>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">Uniqueness</td>
                <td className="px-3 py-2 border-t border-border">100% uniqueness for contract keys</td>
                <td className="px-3 py-2 border-t border-border">Primary key + uniqueness tests</td>
              </tr>
              <tr className="odd:bg-surface-elevated even:bg-surface-primary/40">
                <td className="px-3 py-2 border-t border-border">Enum Coverage</td>
                <td className="px-3 py-2 border-t border-border">100% valid states for status/stage fields</td>
                <td className="px-3 py-2 border-t border-border">Accepted values tests</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="incident-response-and-runbooks" className="bg-surface-elevated border border-border rounded-lg p-5 space-y-2">
        <h2 className="text-base font-semibold text-content-primary">Incident Response and Runbooks</h2>
        <ul className="list-disc pl-5 text-sm text-content-secondary space-y-1">
          <li>Any governed metric SLO breach creates a data incident within 15 minutes.</li>
          <li>Owner acknowledges in 30 minutes; on-call assumes ownership if no response.</li>
          <li>Recovery target: 4 hours for growth/product metrics, 8 hours for finance metrics.</li>
          <li>Postmortem required for any outage over 2 hours, with prevention actions tracked.</li>
        </ul>
      </section>

      <section className="bg-surface-elevated border border-border rounded-lg p-5 space-y-2">
        <h2 className="text-base font-semibold text-content-primary">Documentation Standard</h2>
        <ul className="list-disc pl-5 text-sm text-content-secondary space-y-1">
          <li>Every production metric requires: owner, approver, grain, formula, source tables, and runbook.</li>
          <li>Any schema or formula change must include a changelog entry and migration notes.</li>
          <li>Deprecated metrics remain documented for 30 days with replacement guidance.</li>
        </ul>
      </section>
    </main>
  );
}
