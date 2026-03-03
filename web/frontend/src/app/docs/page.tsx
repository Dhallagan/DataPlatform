'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import DocMeta from '@/components/DocMeta';

interface DocItem {
  title: string;
  href: string;
  description: string;
  category: 'getting_started' | 'governance' | 'metrics' | 'operations';
  badges?: string[];
}

const DOC_ITEMS: DocItem[] = [
  {
    title: 'Data Standards',
    href: '/docs/standards',
    description: 'Cross-team standards for data quality, reliability, freshness, and incidents.',
    category: 'governance',
    badges: ['Policy'],
  },
  {
    title: 'Metrics Governance',
    href: '/docs/metrics-governance',
    description: 'Metric lifecycle, certification policy, approvals, and change workflow.',
    category: 'governance',
    badges: ['Trust'],
  },
  {
    title: 'Sources of Truth Registry',
    href: '/docs/sources-of-truth',
    description: 'Canonical models and ownership matrix for Growth, Product, Eng, Ops, and Finance.',
    category: 'governance',
    badges: ['RACI'],
  },
  {
    title: 'Instrumentation Standards',
    href: '/docs/instrumentation',
    description: 'Event taxonomy and required fields to support agentic and AI-assisted workflows.',
    category: 'governance',
    badges: ['AI Ready'],
  },
  {
    title: 'Warehouse Build Playbook',
    href: '/docs/warehouse-build',
    description: 'End-to-end system architecture from source systems to analytics consumption.',
    category: 'getting_started',
    badges: ['Core', 'Architecture'],
  },
  {
    title: 'Data Governance Glossary',
    href: '/docs/data-governance',
    description: 'Source dictionary, warehouse layers, and shared business definitions.',
    category: 'governance',
    badges: ['Reference'],
  },
  {
    title: 'Metrics Layer Contracts',
    href: '/docs/metrics-layer',
    description: 'Metric formulas, ownership, SLAs, test coverage, and instrumentation standards.',
    category: 'metrics',
    badges: ['Governed', 'Recommended'],
  },
  {
    title: 'Monitoring Dashboard',
    href: '/monitoring',
    description: 'Freshness, schema drift, and data operations health.',
    category: 'operations',
    badges: ['Ops'],
  },
  {
    title: 'Growth Action Dashboard',
    href: '/growth-actions',
    description: 'Signal queue, pipeline state, and lead action workflows.',
    category: 'operations',
    badges: ['Growth'],
  },
];

const CATEGORY_LABELS: Record<DocItem['category'], string> = {
  getting_started: 'Getting Started',
  governance: 'Governance',
  metrics: 'Metrics',
  operations: 'Operations',
};

const CATEGORY_ORDER: DocItem['category'][] = [
  'getting_started',
  'governance',
  'metrics',
  'operations',
];

export default function DocsIndexPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<DocItem['category'] | 'all'>('all');

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return DOC_ITEMS.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return [item.title, item.description, item.category, (item.badges || []).join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [search, activeCategory]);

  return (
    <main className="space-y-4">
      <section className="bg-surface-elevated border border-border rounded-lg p-6">
        <p className="text-xs uppercase tracking-wide text-content-tertiary">Documentation</p>
        <h1 className="text-2xl font-semibold text-content-primary mt-1">Data Platform Docs</h1>
        <p className="text-sm text-content-secondary mt-2 max-w-3xl">
          Mintlify-style docs hub for architecture, governance, metric contracts, and operational playbooks.
          Use this as the source of truth for how metrics are defined and how teams should act on signals.
        </p>
        <DocMeta
          owner="Data Platform"
          reviewers="Engineering + Domain Analytics"
          lastReviewedOn="2026-03-02"
          reviewCadence="Monthly"
        />
        <div className="mt-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search docs..."
            className="w-full md:w-[460px] px-3 py-2 rounded border border-border bg-surface-primary text-sm text-content-primary placeholder:text-content-tertiary"
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3">
          <div className="bg-surface-elevated border border-border rounded-lg p-3 lg:sticky lg:top-4 space-y-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                activeCategory === 'all' ? 'bg-surface-tertiary text-content-primary' : 'text-content-secondary hover:bg-surface-primary'
              }`}
            >
              All
            </button>
            {CATEGORY_ORDER.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                  activeCategory === category ? 'bg-surface-tertiary text-content-primary' : 'text-content-secondary hover:bg-surface-primary'
                }`}
              >
                {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        </aside>

        <div className="lg:col-span-9 space-y-6">
          {CATEGORY_ORDER.map((category) => {
            const categoryItems = filteredItems.filter((item) => item.category === category);
            if (categoryItems.length === 0) return null;

            return (
              <section key={category} className="space-y-3">
                <h2 className="text-base font-semibold text-content-primary">{CATEGORY_LABELS[category]}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categoryItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-lg border border-border bg-surface-elevated p-4 hover:border-accent transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-content-primary">{item.title}</h3>
                        {(item.badges || []).map((badge) => (
                          <span key={badge} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-content-tertiary">
                            {badge}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-content-secondary leading-relaxed">{item.description}</p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          {filteredItems.length === 0 && (
            <section className="rounded-lg border border-dashed border-border bg-surface-elevated p-6 text-sm text-content-tertiary">
              No docs matched your search.
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
