'use client';

import { useMemo, useState } from 'react';
import { METRIC_CONTRACTS, MetricContract } from '@/lib/metricGlossary';
import DocMeta from '@/components/DocMeta';

const DOMAIN_LABELS: Record<MetricContract['domain'], string> = {
  growth: 'Growth',
  finance: 'Finance',
  product: 'Product',
  ops: 'Ops',
  shared: 'Shared',
};

function statusClasses(status: MetricContract['status']): string {
  if (status === 'governed') return 'bg-success-muted text-success';
  if (status === 'deprecated') return 'bg-error-muted text-error';
  return 'bg-warning-muted text-warning';
}

function certificationClasses(certification: MetricContract['certification']): string {
  if (certification === 'certified') return 'bg-success-muted text-success';
  if (certification === 'provisional') return 'bg-warning-muted text-warning';
  return 'bg-error-muted text-error';
}

export default function MetricsLayerPage() {
  const [search, setSearch] = useState('');
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const contracts = Object.values(METRIC_CONTRACTS);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      if (certifiedOnly && contract.certification !== 'certified') return false;
      if (!term) return true;
      return (
        [
          contract.title,
          contract.key,
          contract.definition,
          contract.formula,
          contract.owner,
          contract.sourceOfTruth.join(' '),
          contract.domain,
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)
      );
    });
  }, [contracts, search, certifiedOnly]);

  const certifiedCount = useMemo(
    () => contracts.filter((contract) => contract.certification === 'certified').length,
    [contracts]
  );

  const filteredCount = filtered.length;

  const grouped = useMemo(() => {
    const base: Record<MetricContract['domain'], MetricContract[]> = {
      growth: [],
      finance: [],
      product: [],
      ops: [],
      shared: [],
    };
    for (const contract of filtered) base[contract.domain].push(contract);
    return base;
  }, [filtered]);

  const domainOrder: MetricContract['domain'][] = ['growth', 'finance', 'product', 'ops', 'shared'];

  return (
    <main className="max-w-7xl space-y-4">
      <section className="bg-surface-elevated border border-border rounded-lg p-5">
        <h1 className="text-lg font-semibold text-content-primary">Metrics Layer Contracts</h1>
        <p className="text-sm text-content-secondary mt-1">
          Governed metric definitions, formulas, ownership, and instrumentation standards.
        </p>
        <DocMeta
          owner="Data Platform"
          reviewers="Finance, Growth, Product, Ops"
          lastReviewedOn="2026-03-02"
          reviewCadence="Weekly"
        />
      </section>

      <section className="bg-surface-elevated border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-4 space-y-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search metrics..."
                className="w-full px-3 py-2 rounded border border-border bg-surface-primary text-sm text-content-primary placeholder:text-content-tertiary"
              />
              <label className="flex items-center gap-2 text-xs text-content-secondary">
                <input
                  type="checkbox"
                  checked={certifiedOnly}
                  onChange={(event) => setCertifiedOnly(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Certified only ({certifiedCount}/{contracts.length})
              </label>
              <p className="text-[11px] text-content-tertiary">Showing {filteredCount} contracts</p>

              <nav className="border border-border rounded-lg bg-surface-primary p-2 space-y-1">
                {domainOrder.map((domain) => {
                  const count = grouped[domain].length;
                  return (
                    <a
                      key={domain}
                      href={`#domain-${domain}`}
                      className="flex items-center justify-between px-2 py-1.5 rounded text-sm text-content-secondary hover:text-content-primary hover:bg-surface-tertiary"
                    >
                      <span>{DOMAIN_LABELS[domain]}</span>
                      <span className="text-xs text-content-tertiary">{count}</span>
                    </a>
                  );
                })}
              </nav>
            </div>
          </aside>

          <div className="lg:col-span-9 space-y-6">
            {domainOrder.map((domain) => (
              <section key={domain} id={`domain-${domain}`} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-content-primary">{DOMAIN_LABELS[domain]}</h2>
                  <span className="text-xs text-content-tertiary">{grouped[domain].length} metrics</span>
                </div>

                {grouped[domain].length === 0 ? (
                  <div className="border border-border rounded-lg bg-surface-primary px-3 py-2 text-sm text-content-tertiary">
                    No metrics in this domain for current filter.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {grouped[domain].map((contract) => (
                      <article key={contract.key} id={contract.key} className="border border-border rounded-lg bg-surface-primary p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-content-primary">{contract.title}</h3>
                            <p className="text-xs text-content-tertiary font-mono">{contract.key}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${certificationClasses(contract.certification)}`}>
                              {contract.certification}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${statusClasses(contract.status)}`}>
                              {contract.status}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${contract.hasTests ? 'bg-success-muted text-success' : 'bg-warning-muted text-warning'}`}>
                              {contract.hasTests ? 'Has tests' : 'No tests'}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-content-secondary">{contract.definition}</p>

                        <div>
                          <p className="text-[11px] text-content-tertiary">Formula</p>
                          <p className="text-xs text-content-primary font-mono">{contract.formula}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-content-tertiary">Grain</p>
                            <p className="text-content-primary">{contract.grain}</p>
                          </div>
                          <div>
                            <p className="text-content-tertiary">Type</p>
                            <p className="text-content-primary capitalize">{contract.kind}</p>
                          </div>
                          <div>
                            <p className="text-content-tertiary">Owner</p>
                            <p className="text-content-primary">{contract.owner}</p>
                          </div>
                          <div>
                            <p className="text-content-tertiary">SLA</p>
                            <p className="text-content-primary">{contract.sla}</p>
                          </div>
                          <div>
                            <p className="text-content-tertiary">Version</p>
                            <p className="text-content-primary">{contract.version}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="border border-border rounded p-2">
                            <p className="text-content-tertiary">Freshness SLO</p>
                            <p className="text-content-primary">{contract.freshnessSlo}</p>
                          </div>
                          <div className="border border-border rounded p-2">
                            <p className="text-content-tertiary">Data Quality SLO</p>
                            <p className="text-content-primary">{contract.dataQualitySlo}</p>
                          </div>
                          <div className="border border-border rounded p-2">
                            <p className="text-content-tertiary">Test Pass Rate</p>
                            <p className="text-content-primary">{contract.testPassRate}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-[11px] text-content-tertiary">Approver</p>
                            <p className="text-content-primary">{contract.approver}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-content-tertiary">On-call</p>
                            <p className="text-content-primary font-mono">{contract.onCall}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] text-content-tertiary">Source of Truth</p>
                          <p className="text-xs text-content-primary font-mono">{contract.sourceOfTruth.join(', ')}</p>
                        </div>

                        <div>
                          <p className="text-[11px] text-content-tertiary">Lineage</p>
                          <p className="text-xs text-content-primary">{contract.lineage}</p>
                        </div>

                        <div>
                          <p className="text-[11px] text-content-tertiary">Instrumentation Standard</p>
                          <p className="text-xs text-content-primary">{contract.instrumentation}</p>
                        </div>

                        <div>
                          <p className="text-[11px] text-content-tertiary">Agent Actions</p>
                          <p className="text-xs text-content-primary font-mono">{contract.agentActions.join(', ')}</p>
                        </div>

                        <div>
                          <p className="text-[11px] text-content-tertiary">Runbook</p>
                          <p className="text-xs text-content-primary font-mono">{contract.runbook}</p>
                        </div>

                        <details className="border border-border rounded p-2 bg-surface-elevated">
                          <summary className="cursor-pointer text-xs text-content-primary font-medium">
                            Agent Contract JSON
                          </summary>
                          <pre className="mt-2 text-[11px] text-content-secondary font-mono overflow-auto">
                            {JSON.stringify(contract, null, 2)}
                          </pre>
                        </details>

                        <p className="text-[11px] text-content-tertiary">Last refreshed: {contract.lastRefreshedAt}</p>
                        <p className="text-[11px] text-content-tertiary">Updated: {contract.updatedAt}</p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
