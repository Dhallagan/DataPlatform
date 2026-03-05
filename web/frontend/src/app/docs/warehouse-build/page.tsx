'use client';

import Link from 'next/link';
import SystemArchitectureDiagram from '@/components/SystemArchitectureDiagram';
import DocMeta from '@/components/DocMeta';

export default function WarehouseBuildDocPage() {
  return (
    <main className="max-w-5xl text-sm text-content-primary leading-6">
      <section className="bg-surface-elevated border border-border rounded-lg p-5 mb-4">
        <h1 className="text-lg font-semibold text-content-primary">Warehouse Build Playbook</h1>
        <p className="text-sm text-content-secondary mt-1">
          Browserbase-style source system to MotherDuck warehouse and self-serve reporting app.
        </p>
        <DocMeta
          owner="Data Platform"
          reviewers="Engineering, Ops"
          lastReviewedOn="2026-03-02"
          reviewCadence="Monthly"
        />
      </section>

      <section className="bg-surface-elevated border border-border rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">System Overview</h2>
          <p className="mt-2 text-content-secondary">
            I built this to solve a simple problem: teams move fast, but data trust usually lags behind. The point of this system
            is to turn messy operational activity into metrics people can actually rely on, without creating a reporting bottleneck.
          </p>
        </div>

          <div>
            <h3 className="text-base font-semibold">Architecture Diagram</h3>
            <p className="mt-2 text-content-secondary">
              End-to-end flow from source capture to self-serve analytics consumption:
            </p>
            <div className="mt-3">
              <SystemArchitectureDiagram />
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold">1) Problem Framing</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-content-secondary">
              <li>Raw product data is useful, but not decision-ready.</li>
              <li>Metrics drift when every dashboard defines business logic differently.</li>
              <li>Teams need answers quickly without turning data into a ticket queue.</li>
              <li>The design has to work now and still hold up as the company scales.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold">2) Source Domain Design</h3>
            <p className="mt-2 text-content-secondary">
              I modeled the source around how the business actually operates, not around isolated tables:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-content-secondary">
              <li><span className="font-medium text-content-primary">Identity and accounts:</span> who the customers are and how users map to orgs.</li>
              <li><span className="font-medium text-content-primary">Product usage:</span> what they run, how sessions behave, and where friction shows up.</li>
              <li><span className="font-medium text-content-primary">Commercial activity:</span> how plans, usage, and invoices connect to revenue.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold">3) Warehouse Architecture</h3>
            <p className="mt-2 text-content-secondary">
              I used MotherDuck as the warehouse layer to simulate a Snowflake-style analytics setup, and organized modeling with dbt
              in a medallion flow:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-content-secondary">
              <li><span className="font-medium text-content-primary">Bronze:</span> raw source-aligned data.</li>
              <li><span className="font-medium text-content-primary">Silver:</span> cleaned and consistent entities/facts.</li>
              <li><span className="font-medium text-content-primary">Gold:</span> business-ready marts and KPI views.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold">4) Modeling Strategy</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-content-secondary">
              <li>Keep ingestion logic separate from business logic.</li>
              <li>Centralize metric definitions so every team reads the same numbers.</li>
              <li>Make models reusable so new reports do not require reinventing joins.</li>
              <li>Design grains and entities to answer product, growth, finance, and ops questions from one foundation.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold">5) Consumption Layer (Self-Serve Portal)</h3>
            <p className="mt-2 text-content-secondary">
              I wanted the output to be usable immediately, so I built a self-serve portal on top of the metric layer.
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-content-secondary">
              <li><span className="font-medium text-content-primary">Dashboards:</span> department-level KPI widgets and trend views.</li>
              <li><span className="font-medium text-content-primary">Reports:</span> curated SQL cards teams can run, edit, and export.</li>
              <li><span className="font-medium text-content-primary">Consistency:</span> dashboards and reports read from the same governed layer.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold">6) Outcomes</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-content-secondary">
              <li>Faster time from question to answer.</li>
              <li>Less KPI ambiguity across teams.</li>
              <li>Higher trust because logic is repeatable and centralized.</li>
              <li>A clean path to production controls (freshness, governance, and access policies).</li>
            </ul>
          </div>

        <div className="pt-1 flex flex-wrap gap-2">
          <Link href="/docs/data-governance" className="px-3 py-1.5 rounded bg-surface-tertiary text-content-primary text-xs hover:bg-surface-primary">
            Data Governance Glossary
          </Link>
          <Link href="/dashboards" className="px-3 py-1.5 rounded bg-accent text-white text-xs hover:bg-accent-hover">
            View Dashboards
          </Link>
          <Link href="/reports" className="px-3 py-1.5 rounded bg-surface-tertiary text-content-primary text-xs hover:bg-surface-primary">
            View Reports
          </Link>
        </div>
      </section>
    </main>
  );
}
