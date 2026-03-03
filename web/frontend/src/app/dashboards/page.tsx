'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_LABELS, REPORTS, ReportDefinition, ReportResult, executeReport } from '@/lib/reports';
import ReportDashboardCard from '@/components/ReportDashboardCard';
import Toolbar from '@/components/Toolbar';

interface DashboardState {
  isLoading: boolean;
  result: ReportResult | null;
  error: string | null;
}

const CATEGORY_ORDER: ReportDefinition['category'][] = [
  'executive',
  'revenue',
  'growth',
  'product',
  'ops',
  'engineering',
  'customer_success',
];

function getDefaultParams(report: ReportDefinition): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const parameter of report.parameters) {
    if (parameter.default !== undefined) {
      defaults[parameter.name] = parameter.default;
    }
  }
  return defaults;
}

export default function DashboardsPage() {
  const reports = useMemo(
    () => Object.values(REPORTS).filter((report) => report.category !== 'tools'),
    []
  );

  const [stateByReport, setStateByReport] = useState<Record<string, DashboardState>>({});
  const hasAutoLoaded = useRef(false);

  const runReport = async (report: ReportDefinition) => {
    setStateByReport((prev) => ({
      ...prev,
      [report.id]: { isLoading: true, result: prev[report.id]?.result || null, error: null },
    }));

    try {
      const result = await executeReport(report.id, getDefaultParams(report));
      setStateByReport((prev) => ({
        ...prev,
        [report.id]: { isLoading: false, result, error: null },
      }));
    } catch (error) {
      setStateByReport((prev) => ({
        ...prev,
        [report.id]: { isLoading: false, result: null, error: error instanceof Error ? error.message : 'Failed to load report' },
      }));
    }
  };

  useEffect(() => {
    if (hasAutoLoaded.current) return;
    hasAutoLoaded.current = true;
    reports.forEach((report) => {
      runReport(report);
    });
  }, [reports]);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        <section className="bg-surface-elevated border border-border rounded-lg p-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-content-primary">Dashboards</h1>
            <p className="text-sm text-content-tertiary">Live React dashboards for each report, grouped by department.</p>
          </div>
          <Link
            href="/reports"
            className="px-3 py-1.5 rounded-lg text-sm bg-surface-tertiary hover:bg-surface-primary text-content-primary"
          >
            Open Report Catalog
          </Link>
        </section>

        {CATEGORY_ORDER.map((category) => {
          const categoryReports = reports.filter((report) => report.category === category);
          if (categoryReports.length === 0) return null;

          return (
            <section key={category} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-content-primary">{CATEGORY_LABELS[category]}</h2>
                <p className="text-sm text-content-tertiary">{categoryReports.length} dashboard widgets</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {categoryReports.map((report) => (
                  <ReportDashboardCard
                    key={report.id}
                    report={report}
                    state={stateByReport[report.id] || { isLoading: true, result: null, error: null }}
                    onRefresh={() => runReport(report)}
                    showOpenLink
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
