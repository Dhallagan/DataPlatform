'use client';

import { useEffect, useMemo, useState } from 'react';
import Toolbar from '@/components/Toolbar';

interface QueryPayload {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}

interface ProductKpiRow {
  as_of_date: string;
  sessions_30d: number;
  avg_success_rate_pct_30d: number;
  avg_duration_seconds_30d: number;
  avg_pages_per_session_30d: number;
  avg_proxy_adoption_pct_30d: number;
  avg_stealth_adoption_pct_30d: number;
  peak_unique_domains_visited_30d: number;
}

interface ProductDailyRow {
  metric_date: string;
  total_sessions: number;
  success_rate_pct: number;
  avg_duration_seconds: number;
  avg_pages_visited: number;
  proxy_adoption_pct: number;
  stealth_adoption_pct: number;
  unique_domains_visited: number;
}

interface SessionHealthRow {
  metric_date: string;
  total_sessions: number;
  successful_sessions: number;
  failed_sessions: number;
  timeout_sessions: number;
  success_rate_pct: number;
  total_events: number;
  total_errors: number;
  sessions_with_proxy: number;
  sessions_with_stealth: number;
  chromium_sessions: number;
  firefox_sessions: number;
  webkit_sessions: number;
}

function asString(value: unknown): string {
  return value == null ? '' : String(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toProductKpiRow(row: Record<string, unknown> | undefined): ProductKpiRow | null {
  if (!row) return null;
  return {
    as_of_date: asString(row.as_of_date),
    sessions_30d: asNumber(row.sessions_30d),
    avg_success_rate_pct_30d: asNumber(row.avg_success_rate_pct_30d),
    avg_duration_seconds_30d: asNumber(row.avg_duration_seconds_30d),
    avg_pages_per_session_30d: asNumber(row.avg_pages_per_session_30d),
    avg_proxy_adoption_pct_30d: asNumber(row.avg_proxy_adoption_pct_30d),
    avg_stealth_adoption_pct_30d: asNumber(row.avg_stealth_adoption_pct_30d),
    peak_unique_domains_visited_30d: asNumber(row.peak_unique_domains_visited_30d),
  };
}

function toProductDailyRows(rows: Record<string, unknown>[]): ProductDailyRow[] {
  return rows.map((row) => ({
    metric_date: asString(row.metric_date),
    total_sessions: asNumber(row.total_sessions),
    success_rate_pct: asNumber(row.success_rate_pct),
    avg_duration_seconds: asNumber(row.avg_duration_seconds),
    avg_pages_visited: asNumber(row.avg_pages_visited),
    proxy_adoption_pct: asNumber(row.proxy_adoption_pct),
    stealth_adoption_pct: asNumber(row.stealth_adoption_pct),
    unique_domains_visited: asNumber(row.unique_domains_visited),
  }));
}

function toSessionHealthRows(rows: Record<string, unknown>[]): SessionHealthRow[] {
  return rows.map((row) => ({
    metric_date: asString(row.metric_date),
    total_sessions: asNumber(row.total_sessions),
    successful_sessions: asNumber(row.successful_sessions),
    failed_sessions: asNumber(row.failed_sessions),
    timeout_sessions: asNumber(row.timeout_sessions),
    success_rate_pct: asNumber(row.success_rate_pct),
    total_events: asNumber(row.total_events),
    total_errors: asNumber(row.total_errors),
    sessions_with_proxy: asNumber(row.sessions_with_proxy),
    sessions_with_stealth: asNumber(row.sessions_with_stealth),
    chromium_sessions: asNumber(row.chromium_sessions),
    firefox_sessions: asNumber(row.firefox_sessions),
    webkit_sessions: asNumber(row.webkit_sessions),
  }));
}

function fmtNumber(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

function fmtPct(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '0%';
}

function fmtSeconds(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `${n.toFixed(1)}s` : '0s';
}

export default function ProductActionsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<ProductKpiRow | null>(null);
  const [dailyTrend, setDailyTrend] = useState<ProductDailyRow[]>([]);
  const [sessionHealth, setSessionHealth] = useState<SessionHealthRow[]>([]);

  async function runQuery(sql: string): Promise<Record<string, unknown>[]> {
    const response = await fetch('/api/reports/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    const payload = (await response.json()) as QueryPayload;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error || 'Query failed');
    }
    return payload.data;
  }

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [kpiRows, trendRows, healthRows] = await Promise.all([
        runQuery(`
          SELECT
            as_of_date,
            sessions_30d,
            avg_success_rate_pct_30d,
            avg_duration_seconds_30d,
            avg_pages_per_session_30d,
            avg_proxy_adoption_pct_30d,
            avg_stealth_adoption_pct_30d,
            peak_unique_domains_visited_30d
          FROM product.product_kpis
          ORDER BY as_of_date DESC
          LIMIT 1
        `),
        runQuery(`
          SELECT
            metric_date,
            total_sessions,
            success_rate_pct,
            avg_duration_seconds,
            avg_pages_visited,
            proxy_adoption_pct,
            stealth_adoption_pct,
            unique_domains_visited
          FROM product.product_daily
          WHERE metric_date >= current_date - interval '29 days'
          ORDER BY metric_date DESC
        `),
        runQuery(`
          SELECT
            session_date AS metric_date,
            sum(total_sessions) AS total_sessions,
            sum(successful_sessions) AS successful_sessions,
            sum(failed_sessions) AS failed_sessions,
            sum(timeout_sessions) AS timeout_sessions,
            round(
              100.0 * sum(successful_sessions) / nullif(sum(total_sessions), 0),
              2
            ) AS success_rate_pct,
            sum(total_events) AS total_events,
            sum(total_errors) AS total_errors,
            sum(sessions_with_proxy) AS sessions_with_proxy,
            sum(sessions_with_stealth) AS sessions_with_stealth,
            sum(chromium_sessions) AS chromium_sessions,
            sum(firefox_sessions) AS firefox_sessions,
            sum(webkit_sessions) AS webkit_sessions
          FROM product.daily_sessions
          WHERE session_date >= current_date - interval '13 days'
          GROUP BY 1
          ORDER BY 1 DESC
        `),
      ]);

      setKpis(toProductKpiRow(kpiRows[0]));
      setDailyTrend(toProductDailyRows(trendRows));
      setSessionHealth(toSessionHealthRows(healthRows));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product actions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const avgErrorRate = useMemo(() => {
    if (sessionHealth.length === 0) return 0;
    const totalSessions = sessionHealth.reduce((acc, row) => acc + row.total_sessions, 0);
    const totalErrors = sessionHealth.reduce((acc, row) => acc + row.total_errors, 0);
    if (totalSessions === 0) return 0;
    return (totalErrors / totalSessions) * 100;
  }, [sessionHealth]);

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-surface-elevated border border-border rounded-lg p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-content-primary">Product Action Dashboard</h1>
            <p className="text-sm text-content-tertiary mt-1">
              Monitor product adoption quality and route reliability interventions.
            </p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg text-sm bg-surface-tertiary hover:bg-surface-primary text-content-primary"
            disabled={isLoading}
          >
            Refresh
          </button>
        </section>

        {error && (
          <section className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-700">
            {error}
          </section>
        )}

        {isLoading ? (
          <section className="bg-surface-elevated border border-border rounded-lg p-5 text-sm text-content-tertiary">
            Loading product actions...
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Sessions (30d)</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtNumber(kpis?.sessions_30d)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Avg Success Rate</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtPct(kpis?.avg_success_rate_pct_30d)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Avg Duration</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtSeconds(kpis?.avg_duration_seconds_30d)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Proxy Adoption</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtPct(kpis?.avg_proxy_adoption_pct_30d)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Error Rate (14d)</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtPct(avgErrorRate)}</p>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 bg-surface-elevated border border-border rounded-lg p-4">
                <h2 className="text-base font-semibold text-content-primary mb-3">Product Adoption Trend (30d)</h2>
                <div className="overflow-auto max-h-[420px] border border-border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-primary sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 border-b border-border">Date</th>
                        <th className="text-left px-3 py-2 border-b border-border">Sessions</th>
                        <th className="text-left px-3 py-2 border-b border-border">Success %</th>
                        <th className="text-left px-3 py-2 border-b border-border">Avg Duration</th>
                        <th className="text-left px-3 py-2 border-b border-border">Avg Pages</th>
                        <th className="text-left px-3 py-2 border-b border-border">Proxy %</th>
                        <th className="text-left px-3 py-2 border-b border-border">Stealth %</th>
                        <th className="text-left px-3 py-2 border-b border-border">Unique Domains</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyTrend.map((row) => (
                        <tr key={row.metric_date} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                          <td className="px-3 py-2 border-t border-border text-content-primary">{new Date(row.metric_date).toLocaleDateString()}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.total_sessions)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtPct(row.success_rate_pct)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtSeconds(row.avg_duration_seconds)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtNumber(row.avg_pages_visited)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtPct(row.proxy_adoption_pct)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtPct(row.stealth_adoption_pct)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.unique_domains_visited)}</td>
                        </tr>
                      ))}
                      {dailyTrend.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-3 py-4 text-center text-content-tertiary">
                            No product daily rows available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-elevated border border-border rounded-lg p-4 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-content-primary">KPI Snapshot</h2>
                  <p className="text-xs text-content-tertiary mt-1">
                    {kpis?.as_of_date ? `As of ${new Date(kpis.as_of_date).toLocaleDateString()}` : 'No KPI row'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="bg-surface-primary border border-border rounded p-3 flex items-center justify-between">
                    <span className="text-content-tertiary">Pages / Session</span>
                    <span className="font-semibold text-content-primary">{fmtNumber(kpis?.avg_pages_per_session_30d)}</span>
                  </div>
                  <div className="bg-surface-primary border border-border rounded p-3 flex items-center justify-between">
                    <span className="text-content-tertiary">Stealth Adoption</span>
                    <span className="font-semibold text-content-primary">{fmtPct(kpis?.avg_stealth_adoption_pct_30d)}</span>
                  </div>
                  <div className="bg-surface-primary border border-border rounded p-3 flex items-center justify-between">
                    <span className="text-content-tertiary">Peak Domains</span>
                    <span className="font-semibold text-content-primary">{fmtNumber(kpis?.peak_unique_domains_visited_30d)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-surface-elevated border border-border rounded-lg p-4">
              <h2 className="text-base font-semibold text-content-primary mb-3">Session Reliability Breakdown (14d)</h2>
              <div className="overflow-auto max-h-[420px] border border-border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-surface-primary sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 border-b border-border">Date</th>
                      <th className="text-left px-3 py-2 border-b border-border">Total</th>
                      <th className="text-left px-3 py-2 border-b border-border">Success</th>
                      <th className="text-left px-3 py-2 border-b border-border">Failed</th>
                      <th className="text-left px-3 py-2 border-b border-border">Timeout</th>
                      <th className="text-left px-3 py-2 border-b border-border">Events</th>
                      <th className="text-left px-3 py-2 border-b border-border">Errors</th>
                      <th className="text-left px-3 py-2 border-b border-border">Chromium</th>
                      <th className="text-left px-3 py-2 border-b border-border">Firefox</th>
                      <th className="text-left px-3 py-2 border-b border-border">Webkit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionHealth.map((row) => (
                      <tr key={row.metric_date} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                        <td className="px-3 py-2 border-t border-border text-content-primary">{new Date(row.metric_date).toLocaleDateString()}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.total_sessions)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.successful_sessions)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtNumber(row.failed_sessions)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtNumber(row.timeout_sessions)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.total_events)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.total_errors)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtNumber(row.chromium_sessions)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtNumber(row.firefox_sessions)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtNumber(row.webkit_sessions)}</td>
                      </tr>
                    ))}
                    {sessionHealth.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-4 text-center text-content-tertiary">
                          No session health rows available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
