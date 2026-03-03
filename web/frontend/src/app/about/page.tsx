'use client';

import Link from 'next/link';
import Toolbar from '@/components/Toolbar';
import SystemArchitectureDiagram from '@/components/SystemArchitectureDiagram';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 space-y-4">
        <section className="bg-surface-elevated border border-border rounded-lg p-6">
          <p className="text-xs uppercase tracking-wide text-content-tertiary">About</p>
          <h1 className="mt-1 text-2xl font-semibold text-content-primary">BrowserBase Analytics Platform</h1>
          <p className="mt-2 text-sm text-content-secondary max-w-4xl">
            This platform turns raw operational data into governed, self-serve analytics for Growth, Product, Finance, and Ops.
            It combines source-aligned ingestion, dbt modeling in MotherDuck, and a lightweight reporting interface for fast decisions.
          </p>
        </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-content-primary">System Architecture</h2>
            <p className="mt-1 text-sm text-content-secondary">
              End-to-end flow from source systems to analytics consumption and monitoring.
            </p>
          </div>

          <SystemArchitectureDiagram />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="rounded border border-border bg-surface-primary p-3">
              <p className="font-semibold text-content-primary">Ingest</p>
              <p className="mt-1 text-content-secondary">Source-aligned replication captures operational data with minimal transform.</p>
            </div>
            <div className="rounded border border-border bg-surface-primary p-3">
              <p className="font-semibold text-content-primary">Model</p>
              <p className="mt-1 text-content-secondary">dbt builds canonical entities, marts, and KPI contracts with test coverage.</p>
            </div>
            <div className="rounded border border-border bg-surface-primary p-3">
              <p className="font-semibold text-content-primary">Activate</p>
              <p className="mt-1 text-content-secondary">Dashboards, reports, and monitoring surfaces make metrics usable across teams.</p>
            </div>
          </div>
        </section>

        <section className="bg-surface-elevated border border-border rounded-lg p-6">
          <h2 className="text-base font-semibold text-content-primary">What This Gives Teams</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-content-secondary">
            <li>One governed metric layer across dashboards and ad-hoc reports.</li>
            <li>Faster answers without routing every question through data engineering.</li>
            <li>Operational visibility via freshness and schema-drift monitoring.</li>
          </ul>
          <div className="pt-4 flex flex-wrap gap-2">
            <Link href="/docs" className="px-3 py-1.5 rounded bg-surface-tertiary text-content-primary text-xs hover:bg-surface-primary">
              Open Docs
            </Link>
            <Link href="/dashboards" className="px-3 py-1.5 rounded bg-accent text-white text-xs hover:bg-accent-hover">
              View Dashboards
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
