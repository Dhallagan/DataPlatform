'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Toolbar from '@/components/Toolbar';

const DOC_NAV = [
  { href: '/docs', label: 'Overview', hint: 'Docs hub' },
  { href: '/docs/standards', label: 'Standards', hint: 'Quality + reliability' },
  { href: '/docs/metrics-governance', label: 'Metrics Governance', hint: 'Trust + approvals' },
  { href: '/docs/sources-of-truth', label: 'Sources of Truth', hint: 'Domain ownership' },
  { href: '/docs/instrumentation', label: 'Instrumentation', hint: 'Events + AI readiness' },
  { href: '/about', label: 'About', hint: 'System architecture' },
  { href: '/docs/warehouse-build', label: 'Warehouse Build', hint: 'Playbook' },
  { href: '/docs/data-governance', label: 'Data Governance', hint: 'Schema + glossary' },
  { href: '/docs/metrics-layer', label: 'Metrics Layer', hint: 'Contracts + ownership' },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
            <div className="h-full rounded-xl border border-border bg-surface-elevated p-4 shadow-soft">
              <div className="mb-4 h-1 w-14 rounded bg-accent" />
              <p className="text-[11px] uppercase tracking-widest text-content-tertiary">Data Flight Deck</p>
              <h2 className="mt-1 text-sm font-semibold text-content-primary">Documentation</h2>
              <p className="mt-1 text-xs text-content-secondary">Architecture, ontology, and governed metrics.</p>

              <nav className="mt-5 space-y-1">
                {DOC_NAV.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-lg border px-3 py-2 transition-colors ${
                        active
                          ? 'border-accent bg-accent-subtle'
                          : 'border-transparent hover:border-border hover:bg-surface-secondary'
                      }`}
                    >
                      <p className="text-sm font-medium text-content-primary">{item.label}</p>
                      <p className="text-[11px] text-content-tertiary">{item.hint}</p>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </div>
  );
}
