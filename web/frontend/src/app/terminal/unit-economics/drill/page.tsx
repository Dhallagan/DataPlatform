'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge, Card, EmptyState, LoadingState } from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface CustomerSliceRow {
  metric_month: string;
  organization_id: string;
  organization_name: string;
  plan_name: string;
  total_session_hours: number;
  possible_hours: number | null;
  utilization_pct: number | null;
  expected_revenue_usd: number;
  expected_cost_usd: number;
  expected_margin_usd: number;
  realized_revenue_usd: number;
  realized_margin_usd: number;
}

function normalizeMonth(raw: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

function normalizePlan(raw: string): string {
  return /^[a-zA-Z0-9_-]+$/.test(raw) ? raw : 'blended_total';
}

export default function UnitEconomicsCustomerDrillPage() {
  const searchParams = useSearchParams();
  const targetMonth = normalizeMonth((searchParams.get('month') || '').trim());
  const targetPlan = normalizePlan((searchParams.get('plan') || '').trim() || 'blended_total');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerSliceRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const monthClause = targetMonth
          ? `c.metric_month = DATE '${targetMonth}'`
          : `c.metric_month = (SELECT MAX(metric_month) FROM fin.agg_customer_unit_economics_monthly)`;
        const planClause =
          targetPlan === 'blended_total' ? '' : `AND LOWER(COALESCE(c.primary_plan_name, 'unknown')) = LOWER('${targetPlan.replace(/'/g, "''")}')`;

        const result = await runWarehouseQuerySafe(`
          WITH sliced AS (
            SELECT
              c.metric_month,
              c.organization_id,
              MAX(c.organization_name) AS organization_name,
              COALESCE(MAX(c.primary_plan_name), 'unknown') AS plan_name,
              SUM(c.total_session_hours) AS total_session_hours,
              SUM(c.expected_cost_usd) AS expected_cost_usd,
              SUM(COALESCE(c.realized_revenue_usd, 0)) AS realized_revenue_usd
            FROM fin.agg_customer_unit_economics_monthly c
            WHERE ${monthClause}
              ${planClause}
            GROUP BY 1, 2
          ),
          plan_hours AS (
            SELECT
              plan_name,
              monthly_price_usd,
              CASE
                WHEN LOWER(plan_name) = 'free' THEN 1.0
                WHEN LOWER(plan_name) IN ('developer', 'starter') THEN 100.0
                WHEN LOWER(plan_name) IN ('startup', 'pro') THEN 500.0
                WHEN LOWER(plan_name) IN ('custom', 'enterprise') THEN NULL
                ELSE NULL
              END AS included_hours_per_customer
            FROM silver.stg_plans
          )
          SELECT
            s.metric_month,
            s.organization_id,
            s.organization_name,
            s.plan_name,
            ROUND(COALESCE(s.total_session_hours, 0), 2) AS total_session_hours,
            CASE
              WHEN p.included_hours_per_customer IS NULL THEN NULL
              ELSE ROUND(p.included_hours_per_customer, 2)
            END AS possible_hours,
            CASE
              WHEN p.included_hours_per_customer IS NULL THEN NULL
              ELSE ROUND((COALESCE(s.total_session_hours, 0) / NULLIF(p.included_hours_per_customer, 0)) * 100, 2)
            END AS utilization_pct,
            ROUND(COALESCE(p.monthly_price_usd, 0), 2) AS expected_revenue_usd,
            ROUND(COALESCE(s.expected_cost_usd, 0), 2) AS expected_cost_usd,
            ROUND(COALESCE(p.monthly_price_usd, 0) - COALESCE(s.expected_cost_usd, 0), 2) AS expected_margin_usd,
            ROUND(COALESCE(s.realized_revenue_usd, 0), 2) AS realized_revenue_usd,
            ROUND(COALESCE(s.realized_revenue_usd, 0) - COALESCE(s.expected_cost_usd, 0), 2) AS realized_margin_usd
          FROM sliced s
          LEFT JOIN plan_hours p
            ON LOWER(s.plan_name) = LOWER(p.plan_name)
          ORDER BY expected_cost_usd DESC, total_session_hours DESC
        `);

        setRows(
          result.map((row) => ({
            metric_month: String(row.metric_month ?? ''),
            organization_id: String(row.organization_id ?? ''),
            organization_name: String(row.organization_name ?? ''),
            plan_name: String(row.plan_name ?? 'unknown'),
            total_session_hours: num(row.total_session_hours),
            possible_hours: row.possible_hours == null ? null : num(row.possible_hours),
            utilization_pct: row.utilization_pct == null ? null : num(row.utilization_pct),
            expected_revenue_usd: num(row.expected_revenue_usd),
            expected_cost_usd: num(row.expected_cost_usd),
            expected_margin_usd: num(row.expected_margin_usd),
            realized_revenue_usd: num(row.realized_revenue_usd),
            realized_margin_usd: num(row.realized_margin_usd),
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load customer drill');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [targetMonth, targetPlan]);

  const monthLabel = useMemo(() => (rows[0]?.metric_month ? rows[0].metric_month : targetMonth || 'latest'), [rows, targetMonth]);

  if (loading) {
    return (
      <TerminalShell
        active="unit"
        title="Unit Economics by Customers"
        subtitle="Customer slice from firm unit economics."
      >
        <LoadingState title="Loading customer slice" description="Building customer table for selected plan/month." />
      </TerminalShell>
    );
  }

  if (error) {
    return (
      <TerminalShell
        active="unit"
        title="Unit Economics by Customers"
        subtitle="Customer slice from firm unit economics."
      >
        <EmptyState title="Customer drill unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell
      active="unit"
      title="Unit Economics by Customers"
      subtitle="Customer slice from firm unit economics."
    >
      <Card variant="elevated" className="p-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-content-primary">Customer Slice</h2>
            <Badge variant="neutral">{targetPlan} · {monthLabel}</Badge>
          </div>
          <Link href="/terminal/unit-economics" className="rounded bg-surface-secondary px-2 py-1 text-[10px] text-content-secondary">
            back to firm view
          </Link>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No customers in slice" description="Try another month/plan from the firm matrix drill cells." />
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="min-w-full text-xs leading-tight">
              <thead className="bg-surface-secondary text-content-tertiary">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">Customer</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Plan</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Hours</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Possible Hours</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Utilization</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Expected Revenue</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Expected Cost</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Expected Margin</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Realized Revenue</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Realized Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.metric_month}-${row.organization_id}`} className="border-t border-border">
                    <td className="px-2 py-1.5 text-content-primary">
                      <Link href={`/terminal/unit-economics?customer=${encodeURIComponent(row.organization_id)}`} className="text-accent hover:underline">
                        {row.organization_name}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 text-content-primary">{row.plan_name}</td>
                    <td className="px-2 py-1.5 text-right text-content-primary">{row.total_session_hours.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right text-content-primary">
                      {row.possible_hours == null ? 'n/a' : row.possible_hours.toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-content-primary">
                      {row.utilization_pct == null ? 'n/a' : pct(row.utilization_pct)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-content-primary">{usd(row.expected_revenue_usd)}</td>
                    <td className="px-2 py-1.5 text-right text-content-primary">{usd(row.expected_cost_usd)}</td>
                    <td className="px-2 py-1.5 text-right text-content-primary">{usd(row.expected_margin_usd)}</td>
                    <td className="px-2 py-1.5 text-right text-content-primary">{usd(row.realized_revenue_usd)}</td>
                    <td className="px-2 py-1.5 text-right text-content-primary">{usd(row.realized_margin_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </TerminalShell>
  );
}
