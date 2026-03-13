'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Card, EmptyState, LoadingState } from '@/components/ui';
import TerminalShell from '@/components/terminal/TerminalShell';
import { num, pct, runWarehouseQuerySafe, usd } from '@/lib/warehouse';

interface UnitEconomicsRow {
  metric_month: string;
  plan_name: string;
  is_unlimited_plan: boolean;
  customer_count: number;
  total_session_hours: number;
  possible_hours: number | null;
  utilization_pct: number | null;
  expected_cost_usd: number;
  expected_revenue_usd: number;
  expected_margin_usd: number;
  expected_margin_pct: number | null;
  realized_revenue_usd: number;
  realized_margin_usd: number;
  realized_margin_pct: number | null;
}

export default function UnitEconomicsTerminalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerParam = (searchParams.get('customer') || '').trim();
  const customerFilter = /^[a-zA-Z0-9_-]+$/.test(customerParam) ? customerParam : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<UnitEconomicsRow[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const whereClause = customerFilter
          ? `AND c.organization_id = '${customerFilter.replace(/'/g, "''")}'`
          : '';

        const result = await runWarehouseQuerySafe(`
          WITH month_window AS (
            SELECT
              DATE_TRUNC('month', CURRENT_DATE)::DATE AS current_month,
              (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months')::DATE AS min_month
          ),
          plan_catalog AS (
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
          ),
          monthly_by_plan AS (
            SELECT
              c.metric_month,
              COALESCE(c.primary_plan_name, 'unknown') AS plan_name,
              COUNT(DISTINCT c.organization_id) AS customer_count,
              SUM(c.total_session_hours) AS total_session_hours,
              SUM(c.expected_cost_usd) AS expected_cost_usd,
              SUM(COALESCE(c.realized_revenue_usd, 0)) AS realized_revenue_usd
            FROM fin.agg_customer_unit_economics_monthly c
            CROSS JOIN month_window w
            WHERE c.metric_month BETWEEN w.min_month AND w.current_month
              ${whereClause}
            GROUP BY 1, 2
          ),
          months AS (
            SELECT DISTINCT metric_month
            FROM monthly_by_plan
          ),
          month_plan_grid AS (
            SELECT
              m.metric_month,
              p.plan_name,
              p.monthly_price_usd,
              p.included_hours_per_customer
            FROM months m
            CROSS JOIN plan_catalog p
          )
          SELECT
            g.metric_month,
            g.plan_name,
            (g.included_hours_per_customer IS NULL) AS is_unlimited_plan,
            COALESCE(m.customer_count, 0) AS customer_count,
            ROUND(COALESCE(m.total_session_hours, 0), 2) AS total_session_hours,
            CASE
              WHEN g.included_hours_per_customer IS NULL THEN NULL
              ELSE ROUND(COALESCE(m.customer_count, 0) * COALESCE(g.included_hours_per_customer, 0), 2)
            END AS possible_hours,
            CASE
              WHEN g.included_hours_per_customer IS NULL THEN NULL
              ELSE ROUND(
                (
                  COALESCE(m.total_session_hours, 0)
                  / NULLIF(COALESCE(m.customer_count, 0) * COALESCE(g.included_hours_per_customer, 0), 0)
                ) * 100,
                2
              )
            END AS utilization_pct,
            ROUND(COALESCE(m.expected_cost_usd, 0), 2) AS expected_cost_usd,
            ROUND(COALESCE(m.customer_count, 0) * COALESCE(g.monthly_price_usd, 0), 2) AS expected_revenue_usd,
            ROUND(
              (COALESCE(m.customer_count, 0) * COALESCE(g.monthly_price_usd, 0)) - COALESCE(m.expected_cost_usd, 0),
              2
            ) AS expected_margin_usd,
            ROUND(
              (
                ((COALESCE(m.customer_count, 0) * COALESCE(g.monthly_price_usd, 0)) - COALESCE(m.expected_cost_usd, 0))
                / NULLIF((COALESCE(m.customer_count, 0) * COALESCE(g.monthly_price_usd, 0)), 0)
              ) * 100,
              2
            ) AS expected_margin_pct,
            ROUND(COALESCE(m.realized_revenue_usd, 0), 2) AS realized_revenue_usd,
            ROUND(COALESCE(m.realized_revenue_usd, 0) - COALESCE(m.expected_cost_usd, 0), 2) AS realized_margin_usd,
            ROUND(
              ((COALESCE(m.realized_revenue_usd, 0) - COALESCE(m.expected_cost_usd, 0)) / NULLIF(COALESCE(m.realized_revenue_usd, 0), 0)) * 100,
              2
            ) AS realized_margin_pct
          FROM month_plan_grid g
          LEFT JOIN monthly_by_plan m
            ON g.metric_month = m.metric_month
           AND g.plan_name = m.plan_name
          ORDER BY g.metric_month DESC, g.plan_name
        `);

        setRows(
          result.map((row) => ({
            metric_month: String(row.metric_month ?? ''),
            plan_name: String(row.plan_name ?? ''),
            is_unlimited_plan: Boolean(row.is_unlimited_plan),
            customer_count: num(row.customer_count),
            total_session_hours: num(row.total_session_hours),
            possible_hours: row.possible_hours == null ? null : num(row.possible_hours),
            utilization_pct: row.utilization_pct == null ? null : num(row.utilization_pct),
            expected_cost_usd: num(row.expected_cost_usd),
            expected_revenue_usd: num(row.expected_revenue_usd),
            expected_margin_usd: num(row.expected_margin_usd),
            expected_margin_pct: row.expected_margin_pct == null ? null : num(row.expected_margin_pct),
            realized_revenue_usd: num(row.realized_revenue_usd),
            realized_margin_usd: num(row.realized_margin_usd),
            realized_margin_pct: row.realized_margin_pct == null ? null : num(row.realized_margin_pct),
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load unit economics table');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [customerFilter]);

  const planOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.plan_name))).sort((a, b) => {
        const rank = (plan: string) => {
          const p = plan.toLowerCase();
          if (p === 'free') return 0;
          if (p === 'starter' || p === 'developer') return 1;
          if (p === 'pro' || p === 'startup') return 2;
          if (p === 'enterprise' || p === 'custom') return 3;
          return 99;
        };
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return a.localeCompare(b);
      }),
    [rows],
  );

  const monthColumns = useMemo(
    () => Array.from(new Set(rows.map((row) => row.metric_month))).sort((a, b) => b.localeCompare(a)),
    [rows],
  );

  const byPlanMonth = useMemo(
    () => Object.fromEntries(rows.map((row) => [`${row.plan_name}__${row.metric_month}`, row])),
    [rows],
  );

  const blendedByMonth = useMemo(() => {
    const acc: Record<string, UnitEconomicsRow & { unlimited_customers: number }> = {};
    for (const row of rows) {
      const key = row.metric_month;
      if (!acc[key]) {
        acc[key] = {
          metric_month: row.metric_month,
          plan_name: 'blended_total',
          is_unlimited_plan: false,
          customer_count: 0,
          total_session_hours: 0,
          possible_hours: 0,
          utilization_pct: null,
          expected_cost_usd: 0,
          expected_revenue_usd: 0,
          expected_margin_usd: 0,
          expected_margin_pct: null,
          realized_revenue_usd: 0,
          realized_margin_usd: 0,
          realized_margin_pct: null,
          unlimited_customers: 0,
        };
      }
      const cur = acc[key];
      cur.customer_count += row.customer_count;
      cur.total_session_hours += row.total_session_hours;
      cur.expected_cost_usd += row.expected_cost_usd;
      cur.expected_revenue_usd += row.expected_revenue_usd;
      cur.expected_margin_usd += row.expected_margin_usd;
      cur.realized_revenue_usd += row.realized_revenue_usd;
      cur.realized_margin_usd += row.realized_margin_usd;
      if (row.is_unlimited_plan) {
        cur.unlimited_customers += row.customer_count;
      } else {
        cur.possible_hours = (cur.possible_hours ?? 0) + (row.possible_hours ?? 0);
      }
    }

    for (const key of Object.keys(acc)) {
      const row = acc[key];
      if (row.unlimited_customers > 0) {
        row.is_unlimited_plan = true;
        row.possible_hours = null;
        row.utilization_pct = null;
      } else {
        const possible = row.possible_hours ?? 0;
        row.utilization_pct = possible > 0 ? (row.total_session_hours / possible) * 100 : null;
      }
      row.expected_margin_pct =
        row.expected_revenue_usd > 0 ? (row.expected_margin_usd / row.expected_revenue_usd) * 100 : null;
      row.realized_margin_pct =
        row.realized_revenue_usd > 0 ? (row.realized_margin_usd / row.realized_revenue_usd) * 100 : null;
    }

    return acc;
  }, [rows]);

  const matrixRows = useMemo(
    () => [
      { label: 'Customers', render: (row: UnitEconomicsRow | undefined) => (row ? String(row.customer_count) : '0') },
      { label: 'Drill', render: (row: UnitEconomicsRow | undefined) => (row ? 'Open' : '-') },
      { label: 'Hours Used', render: (row: UnitEconomicsRow | undefined) => (row ? row.total_session_hours.toFixed(2) : '0.00') },
      {
        label: 'Possible Hours',
        render: (row: UnitEconomicsRow | undefined) =>
          row?.is_unlimited_plan || row?.possible_hours == null ? 'n/a' : row.possible_hours.toFixed(2),
      },
      { label: 'Utilization %', render: (row: UnitEconomicsRow | undefined) => (row?.utilization_pct == null ? 'n/a' : pct(row.utilization_pct)) },
      { label: 'Expected Revenue', render: (row: UnitEconomicsRow | undefined) => usd(row?.expected_revenue_usd ?? 0) },
      { label: 'Expected Cost', render: (row: UnitEconomicsRow | undefined) => usd(row?.expected_cost_usd ?? 0) },
      { label: 'Expected Margin $', render: (row: UnitEconomicsRow | undefined) => usd(row?.expected_margin_usd ?? 0) },
      { label: 'Expected Margin %', render: (row: UnitEconomicsRow | undefined) => (row?.expected_margin_pct == null ? 'n/a' : pct(row.expected_margin_pct)) },
      { label: 'Realized Revenue', render: (row: UnitEconomicsRow | undefined) => usd(row?.realized_revenue_usd ?? 0) },
      { label: 'Realized Margin $', render: (row: UnitEconomicsRow | undefined) => usd(row?.realized_margin_usd ?? 0) },
      { label: 'Realized Margin %', render: (row: UnitEconomicsRow | undefined) => (row?.realized_margin_pct == null ? 'n/a' : pct(row.realized_margin_pct)) },
    ],
    [],
  );

  const openDrill = (plan: string, month: string) => {
    const qs = new URLSearchParams({ plan, month });
    router.push(`/terminal/unit-economics/drill?${qs.toString()}`);
  };

  if (loading) {
    return (
      <TerminalShell
        active="unit"
        title="Unit Economics Terminal"
        subtitle="Single source table for month x plan expected and realized unit economics."
      >
        <LoadingState title="Loading unit economics" description="Building month-by-plan economics table." />
      </TerminalShell>
    );
  }

  if (error) {
    return (
      <TerminalShell
        active="unit"
        title="Unit Economics Terminal"
        subtitle="Single source table for month x plan expected and realized unit economics."
      >
        <EmptyState title="Unit economics unavailable" description={error} actionLabel="Retry" onAction={() => window.location.reload()} />
      </TerminalShell>
    );
  }

  return (
    <TerminalShell
      active="unit"
      title="Unit Economics Terminal"
      subtitle={
        customerFilter
          ? `Customer view for ${customerFilter}. Month x plan expected and realized unit economics.`
          : 'Single source table for month x plan expected and realized unit economics.'
      }
    >
      <Card variant="elevated" className="p-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-content-primary">Unit Economics Matrix</h2>
          <div className="flex items-center gap-2">
            {customerFilter ? (
              <Link href="/terminal/unit-economics" className="rounded bg-surface-secondary px-2 py-1 text-[10px] text-content-secondary">
                clear customer
              </Link>
            ) : null}
            <Badge variant="neutral">click Customers/Drill cell to open Drill page</Badge>
          </div>
        </div>

        {monthColumns.length === 0 ? (
          <EmptyState title="No matrix rows" description="No unit economics rows available." />
        ) : (
          <div className="overflow-x-auto rounded border border-border">
            <table className="min-w-full text-xs leading-tight">
              <thead className="bg-surface-secondary text-content-tertiary">
                <tr>
                  <th className="sticky left-0 z-10 bg-surface-secondary px-2 py-1.5 text-left font-semibold">Metric</th>
                  {monthColumns.map((month) => (
                    <th key={month} className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                      {month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border bg-surface-secondary/70">
                  <td colSpan={1 + monthColumns.length} className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
                    blended total
                  </td>
                </tr>
                {matrixRows.map((metric) => (
                  <tr key={`blended-${metric.label}`} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-surface-primary px-2 py-1.5 font-medium text-content-primary">{metric.label}</td>
                    {monthColumns.map((month) => {
                      const isDrillCell = metric.label === 'Customers' || metric.label === 'Drill';
                      return (
                        <td
                          key={`blended-${metric.label}-${month}`}
                          className={`whitespace-nowrap px-2 py-1.5 text-right text-content-primary ${isDrillCell && !customerFilter ? 'cursor-pointer hover:bg-surface-tertiary' : ''}`}
                          onClick={() => {
                            if (!isDrillCell || customerFilter) return;
                            openDrill('blended_total', month);
                          }}
                        >
                          {metric.render(blendedByMonth[month])}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {planOptions.map((plan) => (
                  <Fragment key={plan}>
                    <tr className="border-t border-border bg-surface-secondary/50">
                      <td colSpan={1 + monthColumns.length} className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
                        {plan}
                      </td>
                    </tr>
                    {matrixRows.map((metric) => (
                      <tr key={`${plan}-${metric.label}`} className="border-t border-border">
                        <td className="sticky left-0 z-10 bg-surface-primary px-2 py-1.5 font-medium text-content-primary">{metric.label}</td>
                        {monthColumns.map((month) => {
                          const row = byPlanMonth[`${plan}__${month}`] as UnitEconomicsRow | undefined;
                          const isDrillCell = metric.label === 'Customers' || metric.label === 'Drill';
                          return (
                            <td
                              key={`${plan}-${metric.label}-${month}`}
                              className={`whitespace-nowrap px-2 py-1.5 text-right text-content-primary ${isDrillCell && !customerFilter ? 'cursor-pointer hover:bg-surface-tertiary' : ''}`}
                              onClick={() => {
                                if (!isDrillCell || customerFilter) return;
                                openDrill(plan, month);
                              }}
                            >
                              {metric.render(row)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </TerminalShell>
  );
}
