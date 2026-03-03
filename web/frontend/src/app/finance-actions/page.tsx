'use client';

import { useEffect, useMemo, useState } from 'react';
import Toolbar from '@/components/Toolbar';
import MetricHelpButton from '@/components/MetricHelpButton';
import { getMetricContract } from '@/lib/metricGlossary';

interface QueryPayload {
  success: boolean;
  data?: Record<string, unknown>[];
  error?: string;
}

interface MonthlyRevenueRow {
  revenue_month: string;
  realized_revenue_usd: number;
  pending_revenue_usd: number;
  gross_revenue_usd: number;
  avg_collection_rate_pct: number;
  paid_invoices: number;
  open_invoices: number;
}

interface MrrSnapshotRow {
  as_of_date: string;
  total_mrr_usd: number;
  total_paying_customers: number;
  arpu_usd: number;
  starter_mrr_usd: number;
  pro_mrr_usd: number;
  enterprise_mrr_usd: number;
}

interface SpendBySourceRow {
  spend_month: string;
  spend_source: string;
  total_spend_usd: number;
  total_records: number;
}

interface VendorSpendRow {
  vendor_name: string;
  total_spend_usd: number;
  organization_count: number;
}

interface BudgetVsActualRow {
  budget_month: string;
  budget_allocated_usd: number;
  actual_spend_usd: number;
  budget_variance_usd: number;
  budget_utilization_ratio: number;
  ap_open_usd: number;
}

function asString(value: unknown): string {
  return value == null ? '' : String(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMonthlyRevenueRows(rows: Record<string, unknown>[]): MonthlyRevenueRow[] {
  return rows.map((row) => ({
    revenue_month: asString(row.revenue_month),
    realized_revenue_usd: asNumber(row.realized_revenue_usd),
    pending_revenue_usd: asNumber(row.pending_revenue_usd),
    gross_revenue_usd: asNumber(row.gross_revenue_usd),
    avg_collection_rate_pct: asNumber(row.avg_collection_rate_pct),
    paid_invoices: asNumber(row.paid_invoices),
    open_invoices: asNumber(row.open_invoices),
  }));
}

function toMrrSnapshotRow(row: Record<string, unknown> | undefined): MrrSnapshotRow | null {
  if (!row) return null;
  return {
    as_of_date: asString(row.as_of_date),
    total_mrr_usd: asNumber(row.total_mrr_usd),
    total_paying_customers: asNumber(row.total_paying_customers),
    arpu_usd: asNumber(row.arpu_usd),
    starter_mrr_usd: asNumber(row.starter_mrr_usd),
    pro_mrr_usd: asNumber(row.pro_mrr_usd),
    enterprise_mrr_usd: asNumber(row.enterprise_mrr_usd),
  };
}

function toSpendBySourceRows(rows: Record<string, unknown>[]): SpendBySourceRow[] {
  return rows.map((row) => ({
    spend_month: asString(row.spend_month),
    spend_source: asString(row.spend_source),
    total_spend_usd: asNumber(row.total_spend_usd),
    total_records: asNumber(row.total_records),
  }));
}

function toVendorSpendRows(rows: Record<string, unknown>[]): VendorSpendRow[] {
  return rows.map((row) => ({
    vendor_name: asString(row.vendor_name),
    total_spend_usd: asNumber(row.total_spend_usd),
    organization_count: asNumber(row.organization_count),
  }));
}

function toBudgetVsActualRows(rows: Record<string, unknown>[]): BudgetVsActualRow[] {
  return rows.map((row) => ({
    budget_month: asString(row.budget_month),
    budget_allocated_usd: asNumber(row.budget_allocated_usd),
    actual_spend_usd: asNumber(row.actual_spend_usd),
    budget_variance_usd: asNumber(row.budget_variance_usd),
    budget_utilization_ratio: asNumber(row.budget_utilization_ratio),
    ap_open_usd: asNumber(row.ap_open_usd),
  }));
}

function fmtNumber(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

function fmtMoney(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n)
    ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : '$0';
}

function fmtPct(value: unknown): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : '0%';
}

export default function FinanceActionsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenueRow[]>([]);
  const [mrrSnapshot, setMrrSnapshot] = useState<MrrSnapshotRow | null>(null);
  const [spendBySource, setSpendBySource] = useState<SpendBySourceRow[]>([]);
  const [vendorSpend, setVendorSpend] = useState<VendorSpendRow[]>([]);
  const [budgetVsActual, setBudgetVsActual] = useState<BudgetVsActualRow[]>([]);

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
      const [monthlyRows, mrrRows, sourceRows, vendorRows, budgetRows] = await Promise.all([
        runQuery(`
          SELECT
            revenue_month,
            round(sum(realized_revenue_usd), 2) AS realized_revenue_usd,
            round(sum(pending_revenue_usd), 2) AS pending_revenue_usd,
            round(sum(gross_revenue_usd), 2) AS gross_revenue_usd,
            round(avg(collection_rate_pct), 2) AS avg_collection_rate_pct,
            sum(paid_invoice_count) AS paid_invoices,
            sum(open_invoice_count) AS open_invoices
          FROM finance.monthly_revenue
          WHERE revenue_month >= date_trunc('month', current_date) - interval '5 months'
          GROUP BY 1
          ORDER BY revenue_month DESC
        `),
        runQuery(`
          SELECT
            as_of_date,
            total_mrr_usd,
            total_paying_customers,
            arpu_usd,
            starter_mrr_usd,
            pro_mrr_usd,
            enterprise_mrr_usd
          FROM finance.mrr
          ORDER BY as_of_date DESC
          LIMIT 1
        `),
        runQuery(`
          SELECT
            spend_month,
            spend_source,
            round(sum(spend_usd), 2) AS total_spend_usd,
            sum(record_count) AS total_records
          FROM finance.ramp_spend_monthly
          WHERE spend_month >= date_trunc('month', current_date) - interval '2 months'
          GROUP BY 1, 2
          ORDER BY spend_month DESC, total_spend_usd DESC
        `),
        runQuery(`
          SELECT
            vendor_name,
            round(sum(total_spend_usd), 2) AS total_spend_usd,
            count(distinct organization_id) AS organization_count
          FROM finance.ramp_vendor_spend_monthly
          WHERE spend_month >= date_trunc('month', current_date) - interval '1 month'
          GROUP BY 1
          ORDER BY total_spend_usd DESC
          LIMIT 20
        `),
        runQuery(`
          SELECT
            budget_month,
            round(sum(budget_allocated_usd), 2) AS budget_allocated_usd,
            round(sum(actual_spend_usd), 2) AS actual_spend_usd,
            round(sum(budget_variance_usd), 2) AS budget_variance_usd,
            round(
              100.0 * sum(actual_spend_usd) / nullif(sum(budget_allocated_usd), 0),
              2
            ) AS budget_utilization_ratio,
            round(sum(ap_open_usd), 2) AS ap_open_usd
          FROM finance.finance_budget_vs_actual_monthly
          WHERE budget_month >= date_trunc('month', current_date) - interval '5 months'
          GROUP BY 1
          ORDER BY budget_month DESC
        `),
      ]);

      setMonthlyRevenue(toMonthlyRevenueRows(monthlyRows));
      setMrrSnapshot(toMrrSnapshotRow(mrrRows[0]));
      setSpendBySource(toSpendBySourceRows(sourceRows));
      setVendorSpend(toVendorSpendRows(vendorRows));
      setBudgetVsActual(toBudgetVsActualRows(budgetRows));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load finance actions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const latestRevenueMonth = monthlyRevenue[0] ?? null;
  const totalOpenInvoices = useMemo(
    () => monthlyRevenue.reduce((acc, row) => acc + row.open_invoices, 0),
    [monthlyRevenue]
  );
  const totalVendorSpend = useMemo(
    () => vendorSpend.reduce((acc, row) => acc + row.total_spend_usd, 0),
    [vendorSpend]
  );
  const latestBudgetMonth = budgetVsActual[0] ?? null;

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Toolbar />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-surface-elevated border border-border rounded-lg p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-content-primary">Finance Action Dashboard</h1>
            <p className="text-sm text-content-tertiary mt-1">
              Manage collections, revenue quality, and spend concentration from one operating view.
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
            Loading finance actions...
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">Total MRR</p>
                  <MetricHelpButton contract={getMetricContract('finance_actions.total_mrr')} />
                </div>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtMoney(mrrSnapshot?.total_mrr_usd)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">Paying Customers</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtNumber(mrrSnapshot?.total_paying_customers)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-content-tertiary">ARPU</p>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtMoney(mrrSnapshot?.arpu_usd)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">Collection Rate (Latest Month)</p>
                  <MetricHelpButton contract={getMetricContract('finance_actions.collection_rate_latest_month')} />
                </div>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtPct(latestRevenueMonth?.avg_collection_rate_pct)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">Open Invoices (12m)</p>
                  <MetricHelpButton contract={getMetricContract('finance_actions.open_invoices_12m')} />
                </div>
                <p className="text-2xl font-semibold text-content-primary mt-1">{fmtNumber(totalOpenInvoices)}</p>
              </div>
              <div className="bg-surface-elevated border border-border rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-content-tertiary">Budget Variance (Latest)</p>
                  <MetricHelpButton contract={getMetricContract('finance_actions.budget_variance_latest_month')} />
                </div>
                <p className={`text-2xl font-semibold mt-1 ${Number(latestBudgetMonth?.budget_variance_usd || 0) < 0 ? 'text-error' : 'text-content-primary'}`}>
                  {fmtMoney(latestBudgetMonth?.budget_variance_usd)}
                </p>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 bg-surface-elevated border border-border rounded-lg p-4">
                <h2 className="text-base font-semibold text-content-primary mb-3">Revenue Quality (Last 6 Months)</h2>
                <div className="overflow-auto max-h-[420px] border border-border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-primary sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 border-b border-border">Month</th>
                        <th className="text-left px-3 py-2 border-b border-border">Realized</th>
                        <th className="text-left px-3 py-2 border-b border-border">Pending</th>
                        <th className="text-left px-3 py-2 border-b border-border">Gross</th>
                        <th className="text-left px-3 py-2 border-b border-border">Collection %</th>
                        <th className="text-left px-3 py-2 border-b border-border">Pending %</th>
                        <th className="text-left px-3 py-2 border-b border-border">Net Cash</th>
                        <th className="text-left px-3 py-2 border-b border-border">Paid Invoices</th>
                        <th className="text-left px-3 py-2 border-b border-border">Open Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyRevenue.map((row) => (
                        <tr key={row.revenue_month} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                          <td className="px-3 py-2 border-t border-border text-content-primary">
                            {row.revenue_month ? new Date(row.revenue_month).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtMoney(row.realized_revenue_usd)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtMoney(row.pending_revenue_usd)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtMoney(row.gross_revenue_usd)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtPct(row.avg_collection_rate_pct)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-tertiary">
                            {fmtPct(row.gross_revenue_usd > 0 ? (row.pending_revenue_usd / row.gross_revenue_usd) * 100 : 0)}
                          </td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">
                            {fmtMoney(row.realized_revenue_usd - row.pending_revenue_usd)}
                          </td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.paid_invoices)}</td>
                          <td className="px-3 py-2 border-t border-border text-content-primary">{fmtNumber(row.open_invoices)}</td>
                        </tr>
                      ))}
                      {monthlyRevenue.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-3 py-4 text-center text-content-tertiary">
                            No monthly revenue rows found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-elevated border border-border rounded-lg p-4 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-content-primary">MRR Plan Mix</h2>
                  <p className="text-xs text-content-tertiary mt-1">
                    {mrrSnapshot?.as_of_date ? `As of ${new Date(mrrSnapshot.as_of_date).toLocaleDateString()}` : 'No MRR row'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="bg-surface-primary border border-border rounded p-3 flex items-center justify-between">
                    <span className="text-content-tertiary">Starter</span>
                    <span className="font-semibold text-content-primary">{fmtMoney(mrrSnapshot?.starter_mrr_usd)}</span>
                  </div>
                  <div className="bg-surface-primary border border-border rounded p-3 flex items-center justify-between">
                    <span className="text-content-tertiary">Pro</span>
                    <span className="font-semibold text-content-primary">{fmtMoney(mrrSnapshot?.pro_mrr_usd)}</span>
                  </div>
                  <div className="bg-surface-primary border border-border rounded p-3 flex items-center justify-between">
                    <span className="text-content-tertiary">Enterprise</span>
                    <span className="font-semibold text-content-primary">{fmtMoney(mrrSnapshot?.enterprise_mrr_usd)}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-content-primary mb-2">Spend by Source (Recent)</h3>
                  <div className="space-y-1 max-h-[190px] overflow-auto">
                    {spendBySource.length === 0 && <p className="text-xs text-content-tertiary">No spend rows found.</p>}
                    {spendBySource.map((row, idx) => (
                      <div key={`${row.spend_month}-${row.spend_source}-${idx}`} className="flex items-center justify-between text-xs border border-border rounded px-2 py-1 bg-surface-primary">
                        <span className="font-mono text-content-primary">{row.spend_source}</span>
                        <span className="text-content-tertiary">{new Date(row.spend_month).toLocaleDateString()}</span>
                        <span className="text-content-primary">{fmtMoney(row.total_spend_usd)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-surface-elevated border border-border rounded-lg p-4">
              <h2 className="text-base font-semibold text-content-primary mb-3">Top Vendor Spend (Last 60 Days)</h2>
              <div className="overflow-auto max-h-[420px] border border-border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-surface-primary sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 border-b border-border">Vendor</th>
                      <th className="text-left px-3 py-2 border-b border-border">Spend</th>
                      <th className="text-left px-3 py-2 border-b border-border">Share</th>
                      <th className="text-left px-3 py-2 border-b border-border">Orgs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorSpend.map((row, idx) => (
                      <tr key={`${row.vendor_name}-${idx}`} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                        <td className="px-3 py-2 border-t border-border text-content-primary">{row.vendor_name}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtMoney(row.total_spend_usd)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">
                          {fmtPct(totalVendorSpend > 0 ? (row.total_spend_usd / totalVendorSpend) * 100 : 0)}
                        </td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtNumber(row.organization_count)}</td>
                      </tr>
                    ))}
                    {vendorSpend.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-4 text-center text-content-tertiary">
                          No vendor spend rows available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-surface-elevated border border-border rounded-lg p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-base font-semibold text-content-primary">Budget vs Actual (Last 6 Months)</h2>
                <MetricHelpButton contract={getMetricContract('finance_actions.budget_vs_actual_monthly')} />
              </div>
              <div className="overflow-auto max-h-[420px] border border-border rounded">
                <table className="w-full text-xs">
                  <thead className="bg-surface-primary sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 border-b border-border">Month</th>
                      <th className="text-left px-3 py-2 border-b border-border">Budget</th>
                      <th className="text-left px-3 py-2 border-b border-border">Actual Spend</th>
                      <th className="text-left px-3 py-2 border-b border-border">Variance</th>
                      <th className="text-left px-3 py-2 border-b border-border">Utilization %</th>
                      <th className="text-left px-3 py-2 border-b border-border">AP Liability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetVsActual.map((row) => (
                      <tr key={row.budget_month} className="odd:bg-surface-elevated even:bg-surface-primary/40">
                        <td className="px-3 py-2 border-t border-border text-content-primary">
                          {row.budget_month ? new Date(row.budget_month).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtMoney(row.budget_allocated_usd)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-primary">{fmtMoney(row.actual_spend_usd)}</td>
                        <td className={`px-3 py-2 border-t border-border ${row.budget_variance_usd < 0 ? 'text-error' : 'text-content-primary'}`}>
                          {fmtMoney(row.budget_variance_usd)}
                        </td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtPct(row.budget_utilization_ratio)}</td>
                        <td className="px-3 py-2 border-t border-border text-content-tertiary">{fmtMoney(row.ap_open_usd)}</td>
                      </tr>
                    ))}
                    {budgetVsActual.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-content-tertiary">
                          No budget vs actual rows found.
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
