'use client';

import Link from 'next/link';
import { REPORTS, CATEGORY_LABELS, getReportsByCategory } from '@/lib/reports';
import Toolbar from '@/components/Toolbar';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  executive: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75V3.75zm3.75 11.25h9m-9-3h5.25m-5.25-3h9" />
    </svg>
  ),
  revenue: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-4.5-9.75A2.25 2.25 0 019.75 6h4.5a2.25 2.25 0 010 4.5h-4.5a2.25 2.25 0 100 4.5h4.5A2.25 2.25 0 0116.5 18" />
    </svg>
  ),
  growth: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 19.5h16.5M6 15l3.75-3.75L13.5 15 18 8.25" />
    </svg>
  ),
  product: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15v9h-15v-9zm3 0v9m6-9v9" />
    </svg>
  ),
  ops: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877m-3.703 3.797l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.653-4.655" />
    </svg>
  ),
  engineering: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.75l3-3m0 0l3 3m-3-3v9M9.75 17.25l-3 3m0 0l-3-3m3 3v-9" />
    </svg>
  ),
  customer_success: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0" />
    </svg>
  ),
  tools: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
};

const CATEGORY_COLORS: Record<string, string> = {
  executive: 'bg-violet-500/10 text-violet-600',
  revenue: 'bg-emerald-500/10 text-emerald-600',
  growth: 'bg-cyan-500/10 text-cyan-600',
  product: 'bg-amber-500/10 text-amber-700',
  ops: 'bg-slate-500/10 text-slate-600',
  engineering: 'bg-indigo-500/10 text-indigo-600',
  customer_success: 'bg-rose-500/10 text-rose-600',
  tools: 'bg-gray-500/10 text-gray-600',
};

export default function ReportsPage() {
  const reportsByCategory = getReportsByCategory();
  const categoryOrder = [
    'executive',
    'revenue',
    'growth',
    'product',
    'ops',
    'engineering',
    'customer_success',
    'tools',
  ];

  return (
    <div className="min-h-screen bg-surface-primary">
      <Toolbar />

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        <section className="bg-surface-elevated border border-border rounded-lg p-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-content-primary">Reports</h1>
            <p className="text-sm text-content-tertiary">Run curated MotherDuck business reports or edit SQL directly.</p>
          </div>
          <span className="text-xs text-content-tertiary bg-surface-tertiary px-2 py-1 rounded">
            {Object.keys(REPORTS).length} reports
          </span>
        </section>

        {Object.keys(REPORTS).length === 0 && (
          <section className="rounded-lg border border-dashed border-border bg-surface-elevated p-8 text-center">
            <h2 className="text-base font-semibold text-content-primary">No reports configured</h2>
            <p className="text-sm text-content-tertiary mt-1">Add report definitions in the frontend catalog to make them visible here.</p>
          </section>
        )}

        {categoryOrder.map((category) => {
          const reports = reportsByCategory[category] || [];
          if (reports.length === 0) return null;

          return (
            <section key={category}>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[category]}`}>
                  {CATEGORY_ICONS[category]}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-content-primary">{CATEGORY_LABELS[category]}</h2>
                  <p className="text-sm text-content-tertiary">
                    {category === 'executive' && 'Company-level KPIs and summary performance'}
                    {category === 'revenue' && 'MRR, collections, and monetization health'}
                    {category === 'growth' && 'Acquisition, activation, and retention trends'}
                    {category === 'product' && 'Feature adoption and product usage behavior'}
                    {category === 'ops' && 'Operational throughput and infrastructure usage'}
                    {category === 'engineering' && 'Reliability, latency, and error quality'}
                    {category === 'customer_success' && 'Account health and churn-risk signals'}
                    {category === 'tools' && 'Schema discovery and ad-hoc analysis'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {reports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/reports/${report.id}`}
                    className="text-left p-4 rounded-lg bg-surface-elevated border border-border hover:border-accent hover:shadow-soft transition-all group"
                  >
                    <h3 className="text-sm font-semibold text-content-primary group-hover:text-accent transition-colors mb-1">
                      {report.name}
                    </h3>
                    <p className="text-xs text-content-tertiary leading-relaxed line-clamp-2">
                      {report.description}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-[10px] text-content-tertiary">
                      <span>{report.parameters.filter(p => p.required).length} required</span>
                      <span>·</span>
                      <span>{report.parameters.length} params</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
