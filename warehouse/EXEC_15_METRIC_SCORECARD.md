# Executive 15-Metric Scorecard

Data source: live MotherDuck `md:browserbase_demo`  
Generated: 2026-03-05 (America/New_York)
Canonical warehouse object: `term.scorecard_daily`

## Current Snapshot

| # | Metric | Current Value | Grain | Source |
|---|---|---:|---|---|
| 1 | Total MRR USD | 3,081.00 | Daily snapshot | `fin.snap_mrr` |
| 2 | Paying Customers | 19 | Daily snapshot | `fin.snap_mrr` |
| 3 | ARPU USD | 162.16 | Daily snapshot | `fin.snap_mrr` |
| 4 | Realized Revenue USD (Latest Month) | 4,150.30 | Monthly | `fin.agg_revenue_monthly` |
| 5 | Collection Rate % (Latest Month) | 100.00% | Monthly | `fin.agg_revenue_monthly` |
| 6 | Open Invoice Count (Latest Month) | 0 | Monthly | `fin.agg_revenue_monthly` |
| 7 | Open Pipeline USD | 250,000.00 | Daily snapshot | `gtm.snap_pipeline_daily` |
| 8 | Opportunity Win Rate % | 16.67% | Daily snapshot | `gtm.snap_pipeline_daily` |
| 9 | Lead Conversion Rate % | 0.00% | Daily snapshot | `gtm.snap_pipeline_daily` |
| 10 | Leads Created (30d) | 1 | Rolling 30d | `gtm.agg_funnel_daily` |
| 11 | Lead-to-Opportunity Rate % (30d) | 1,200.00%* | Rolling 30d | `gtm.agg_funnel_daily` |
| 12 | Sessions (30d) | 1,000 | Rolling 30d | `eng.kpi_engineering` |
| 13 | Run Success Rate % (30d) | 74.70% | Rolling 30d | `eng.kpi_engineering` |
| 14 | P95 Duration Seconds (30d) | 2,580.00 | Rolling 30d | `eng.kpi_engineering` |
| 15 | Errors per 1k Sessions (30d) | 24.00 | Rolling 30d | `eng.kpi_engineering` |

\* Volatile due to very low lead denominator; monitor with minimum sample guardrail.

## Metric Definitions

1. `total_mrr_usd`
- Owner: Finance
- SQL definition: latest `total_mrr_usd` from `fin.snap_mrr`.

2. `total_paying_customers`
- Owner: Finance
- SQL definition: latest `total_paying_customers` from `fin.snap_mrr`.

3. `arpu_usd`
- Owner: Finance
- SQL definition: latest `arpu_usd` from `fin.snap_mrr`.

4. `realized_revenue_usd_latest_month`
- Owner: Finance Ops
- SQL definition: `SUM(realized_revenue_usd)` at `MAX(revenue_month)` in `fin.agg_revenue_monthly`.

5. `collection_rate_pct_latest_month`
- Owner: Finance Ops
- SQL definition: `SUM(realized_revenue_usd)/SUM(gross_revenue_usd)*100` at latest `revenue_month`.

6. `open_invoice_count_latest_month`
- Owner: Finance Ops
- SQL definition: `SUM(open_invoice_count)` at latest `revenue_month`.

7. `open_pipeline_usd`
- Owner: GTM / RevOps
- SQL definition: latest `open_pipeline_usd` from `gtm.snap_pipeline_daily`.

8. `opportunity_win_rate_pct`
- Owner: GTM / RevOps
- SQL definition: latest `opportunity_win_rate_pct` from `gtm.snap_pipeline_daily`.

9. `lead_conversion_rate_pct`
- Owner: Growth
- SQL definition: latest `lead_conversion_rate_pct` from `gtm.snap_pipeline_daily`.

10. `leads_created_30d`
- Owner: Growth
- SQL definition: `SUM(leads_created)` where `metric_date >= CURRENT_DATE - INTERVAL '30 days'` in `gtm.agg_funnel_daily`.

11. `lead_to_opp_rate_pct_30d`
- Owner: Growth
- SQL definition: `SUM(opportunities_created)/NULLIF(SUM(leads_created),0)*100` over last 30 days in `gtm.agg_funnel_daily`.

12. `sessions_30d`
- Owner: Product + Engineering
- SQL definition: latest `sessions_30d` from `eng.kpi_engineering`.

13. `avg_success_rate_pct_30d`
- Owner: Engineering
- SQL definition: latest `avg_success_rate_pct_30d` from `eng.kpi_engineering`.

14. `avg_p95_duration_seconds_30d`
- Owner: Engineering
- SQL definition: latest `avg_p95_duration_seconds_30d` from `eng.kpi_engineering`.

15. `avg_errors_per_1k_sessions_30d`
- Owner: Engineering
- SQL definition: latest `avg_errors_per_1k_sessions_30d` from `eng.kpi_engineering`.

## Operating Guidance

- Weekly exec review: use this exact 15 set, no ad hoc additions.
- Alert thresholds: define red/yellow bands for all 15 and assign escalation owner.
- Data quality guardrails:
  - Require minimum denominator for rate metrics (for example `leads_created_30d >= 50`).
  - Treat stale data (`>24h` for bronze/silver or `>48h` marts) as scorecard invalid.

## Canonical Query (single-shot pull)

```sql
WITH
mrr AS (
  SELECT as_of_date, total_mrr_usd, total_paying_customers, arpu_usd
  FROM fin.snap_mrr
  ORDER BY as_of_date DESC
  LIMIT 1
),
rev_latest AS (
  SELECT MAX(revenue_month) AS revenue_month
  FROM fin.agg_revenue_monthly
),
rev AS (
  SELECT
    r.revenue_month,
    SUM(r.realized_revenue_usd) AS realized_revenue_usd,
    CASE WHEN SUM(r.gross_revenue_usd)=0 THEN 0
      ELSE ROUND(100.0*SUM(r.realized_revenue_usd)/SUM(r.gross_revenue_usd),2)
    END AS collection_rate_pct,
    SUM(r.open_invoice_count) AS open_invoice_count
  FROM fin.agg_revenue_monthly r
  JOIN rev_latest rl ON r.revenue_month = rl.revenue_month
  GROUP BY 1
),
pipeline AS (
  SELECT as_of_date, open_pipeline_usd, opportunity_win_rate_pct, lead_conversion_rate_pct
  FROM gtm.snap_pipeline_daily
  ORDER BY as_of_date DESC
  LIMIT 1
),
funnel_30d AS (
  SELECT
    SUM(leads_created) AS leads_created_30d,
    CASE WHEN SUM(leads_created)=0 THEN 0
      ELSE ROUND(100.0*SUM(opportunities_created)/SUM(leads_created),2)
    END AS lead_to_opp_rate_pct_30d
  FROM gtm.agg_funnel_daily
  WHERE metric_date >= CURRENT_DATE - INTERVAL '30 days'
),
eng AS (
  SELECT
    sessions_30d,
    avg_success_rate_pct_30d,
    avg_p95_duration_seconds_30d,
    avg_errors_per_1k_sessions_30d
  FROM eng.kpi_engineering
  ORDER BY as_of_date DESC
  LIMIT 1
)
SELECT *
FROM mrr
CROSS JOIN rev
CROSS JOIN pipeline
CROSS JOIN funnel_30d
CROSS JOIN eng;
```
