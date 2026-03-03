'use client';

import Link from 'next/link';
import Toolbar from '@/components/Toolbar';

const ACTION_SURFACES = [
  {
    href: '/growth-actions',
    title: 'Growth Actions',
    description: 'Operate lead, funnel, and signal-driven interventions.',
  },
  {
    href: '/finance-actions',
    title: 'Finance Actions',
    description: 'Monitor collections, spend concentration, and revenue quality.',
  },
  {
    href: '/product-actions',
    title: 'Product Actions',
    description: 'Track adoption quality and reliability interventions.',
  },
];

export default function ActionsPage() {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-surface-elevated border border-border rounded-lg p-5">
          <h1 className="text-xl font-semibold text-content-primary">Actions</h1>
          <p className="text-sm text-content-tertiary mt-1">
            Operational dashboards by business function.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ACTION_SURFACES.map((surface) => (
            <Link
              key={surface.href}
              href={surface.href}
              className="bg-surface-elevated border border-border rounded-lg p-4 hover:bg-surface-primary transition-colors"
            >
              <h2 className="text-base font-semibold text-content-primary">{surface.title}</h2>
              <p className="text-sm text-content-tertiary mt-2">{surface.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
