# Data Dictionary

Last updated: 2026-03-03

This is the canonical business-facing dictionary for the BrowserBase data platform.

## How to read this

- `Layer` indicates where the model sits in the medallion flow.
- `Grain` indicates one row per what.
- `Primary keys / key columns` are the minimum fields to understand joins and semantics.
- For metric definitions, source of truth is `core.metric_registry` / `core.metric_catalog`.

## How to use this platform

### Human workflow (Explorer first)

1. Open `/explorer` and start in `Objects`.
2. Use Quick Find to search tables, columns, or metrics by name.
3. Click `Inspect` on an object to view:
   - owner/certification
   - column definitions
   - preview rows
4. Use `Metrics` tab to confirm canonical KPI definitions before analysis.
5. Use SQL tab only after discovery, and query canonical models (`core`, `finance`, `growth`, `eng`, `ops`, `product`).

### Agent workflow (LLM + metadata APIs)

1. Fetch policy/contract: `GET /llm.txt` (or `/llms.txt`).
2. Fetch catalog context: `GET /api/metadata/llm-context`.
3. Resolve objects via search: `GET /api/metadata/search?q=<term>`.
4. Inspect structure:
   - `GET /api/metadata/tables`
   - `GET /api/metadata/tables/{schema.table}`
   - `GET /api/metadata/tables/{schema.table}/preview`
5. Execute governed analysis queries through the query API (read-only, audited).

### Catalog maintenance workflow

Run this when metadata looks stale or fallback mode appears:

```bash
./pipeline/run_catalog_refresh.sh
```

This rebuilds:
- `core.table_catalog`
- `core.column_catalog`
- `core.metric_catalog`
- `core.lineage_catalog`

## Raw Sources (Bronze)

### `bronze_supabase` (product + billing)

| Object | Grain | Description | Primary keys / key columns |
|---|---|---|---|
| `organizations` | 1 row per organization | Customer organizations (billing entity) | `id` |
| `users` | 1 row per user | Individual users | `id` |
| `organization_members` | 1 row per membership | User to organization relationship | `id`, `organization_id`, `user_id` |
| `plans` | 1 row per plan | Subscription pricing plans | `id` |
| `subscriptions` | 1 row per subscription | Organization subscriptions to plans | `id`, `organization_id`, `plan_id` |
| `api_keys` | 1 row per key | API keys for programmatic access | `id`, `organization_id` |
| `projects` | 1 row per project | Project container for sessions | `id`, `organization_id` |
| `browser_sessions` | 1 row per browser session | Core product session records | `id`, `organization_id`, `project_id` |
| `session_events` | 1 row per event | Session-level events | `id`, `session_id` |
| `usage_records` | 1 row per usage record | Usage aggregates per organization | `id`, `organization_id` |
| `invoices` | 1 row per invoice | Billing invoices | `id`, `organization_id` |

### `bronze_supabase` (GTM-prefixed tables from GTM source)

| Object | Grain | Description | Primary keys / key columns |
|---|---|---|---|
| `gtm_employees` | 1 row per employee | Internal GTM owner directory | `employee_id` |
| `gtm_accounts` | 1 row per account | CRM account entity | `id` |
| `gtm_contacts` | 1 row per contact | CRM contacts | `id`, `account_id` |
| `gtm_leads` | 1 row per lead | Lead records | `id` |
| `gtm_campaigns` | 1 row per campaign | Campaign metadata | `id` |
| `gtm_lead_touches` | 1 row per touch | Attribution touches | `id`, `lead_id` |
| `gtm_opportunities` | 1 row per opportunity | Sales opportunities | `id`, `account_id` |
| `gtm_activities` | 1 row per activity | GTM activity log | `id` |

### `bronze_supabase` (Finance-prefixed tables from finance source)

| Object | Grain | Description | Primary keys / key columns |
|---|---|---|---|
| `finance_departments` | 1 row per department | Finance cost center metadata | `id`, `organization_id` |
| `finance_vendors` | 1 row per vendor | Vendor master data | `id` |
| `finance_cards` | 1 row per card | Card controls/holder metadata | `id`, `organization_id` |
| `finance_transactions` | 1 row per card transaction | Card spend ledger | `id`, `organization_id`, `card_id` |
| `finance_reimbursements` | 1 row per reimbursement | Reimbursement requests | `id`, `organization_id` |
| `finance_bills` | 1 row per bill | AP bills | `id`, `organization_id`, `vendor_id` |
| `finance_bill_payments` | 1 row per payment | Bill payments | `id`, `bill_id` |
| `finance_bill_adjustments` | 1 row per adjustment | Bill-level adjustments | `id`, `bill_id` |
| `finance_payment_reversals` | 1 row per reversal | Payment reversals | `id`, `payment_id` |

## Core Canonical Models (Silver/Core)

| Object | Layer | Grain | Description | Primary keys / key columns |
|---|---|---|---|---|
| `organizations` | Core entity | 1 row per organization | Canonical organization entity | `organization_id` |
| `users` | Core entity | 1 row per user | Canonical user entity | `user_id`, `primary_organization_id` |
| `sessions` | Core entity | 1 row per session | Canonical session entity | `session_id`, `organization_id` |
| `dim_organizations` | Dimension | 1 row per organization | Join-safe organization dimension | `organization_id` |
| `dim_users` | Dimension | 1 row per user | Join-safe user dimension | `user_id`, `organization_id` |
| `fct_browser_sessions` | Fact | 1 row per browser session | Canonical session fact (alias on `sessions.sql`) | `session_id`, `organization_id`, `status` |
| `bridge_organization_activity` | Bridge | 1 row per organization | Organization session aggregates | `organization_id`, `total_sessions` |
| `fct_browser_events` | Fact | 1 row per event | Canonical event fact | `event_id`, `session_id` |
| `fct_subscriptions` | Fact | 1 row per subscription state row | Canonical subscription fact | `subscription_id`, `organization_id`, `subscription_status` |
| `dim_time` | Dimension | 1 row per day | Daily calendar dimension | `date_day`, `month_start` |
| `dim_fin_departments` | Dimension | 1 row per department | Department metadata | `department_id`, `organization_id` |
| `dim_fin_vendors` | Dimension | 1 row per vendor | Vendor metadata | `vendor_id` |
| `dim_fin_cards` | Dimension | 1 row per card | Card metadata | `card_id` |
| `fct_fin_transactions` | Fact | 1 row per transaction | Card transaction fact | `transaction_id`, `transaction_month` |
| `fct_fin_reimbursements` | Fact | 1 row per reimbursement | Reimbursement fact | `reimbursement_id`, `submitted_month` |
| `fct_fin_bills` | Fact | 1 row per bill | AP bill fact | `bill_id`, `bill_month` |
| `fct_fin_bill_payments` | Fact | 1 row per payment | AP payment fact | `bill_payment_id` |

## Domain Analytics Models

### Core Metrics (`core`)

| Object | Grain | Description | Primary keys / key columns |
|---|---|---|---|
| `daily_kpis` | 1 row per date | Executive KPI rollup | `date` |
| `metric_spine` | 1 row per organization per day | Canonical daily metric spine | `metric_date`, `organization_id` |

### GTM (`gtm`)

| Object | Grain | Description | Primary keys / key columns |
|---|---|---|---|
| `agg_growth_daily` | 1 row per date | Daily growth/activation metrics | `metric_date` |
| `kpi_growth` | 1 row per as-of date | 30-day growth KPI summary | `as_of_date` |
| `agg_cohort_retention_weekly` | 1 row per cohort-week x offset | Weekly retention matrix | `cohort_week`, `weeks_since_signup` |
| `agg_active_organizations` | 1 row per organization | 30-day active organization segmentation | `organization_id`, `activity_tier` |
| `cfg_signal_thresholds` | 1 row per signal threshold | Growth workflow threshold config | `signal_name`, `threshold_name` |
| `signal_trial_conversion_risk_daily` | 1 row per signal | Trial conversion risk output | `signal_id`, `organization_id`, `signal_score` |
| `growth_task_queue` | 1 row per task | Growth action queue | `task_id`, `signal_id`, `task_status`, `priority` |
| `action_log` | 1 row per action | Auditable workflow action log | `action_id`, `signal_id`, `task_id`, `organization_id` |
| `agg_funnel_daily` | 1 row per date | GTM funnel KPIs | `metric_date` |
| `snap_pipeline_daily` | 1 row per as-of date | Pipeline state snapshot | `as_of_date` |
| `dim_lifecycle_accounts` | 1 row per account | Account lifecycle spine | `account_id`, `lifecycle_stage` |
| `agg_campaign_channel_monthly` | 1 row per campaign x month | Campaign/channel attribution | `metric_month`, `campaign_id` |
| `agg_unit_economics_monthly` | 1 row per month | CAC/retention/LTV proxy metrics | `metric_month` |

### Product (`pro`)

| Object | Grain | Description | Primary keys / key columns |
|---|---|---|---|
| `agg_sessions_daily` | 1 row per organization per day | Session aggregates | `organization_id`, `session_date` |
| `agg_product_daily` | 1 row per date | Product engagement/failure KPIs | `metric_date` |
| `kpi_product` | 1 row per as-of date | 30-day product KPI summary | `as_of_date` |

### Engineering (`eng`)

| Object | Grain | Description | Primary keys / key columns |
|---|---|---|---|
| `agg_engineering_daily` | 1 row per date | Reliability + latency daily metrics | `metric_date` |
| `kpi_engineering` | 1 row per as-of date | 30-day engineering KPI summary | `as_of_date` |

### Operations (`ops`)

| Object | Grain | Description | Primary keys / key columns |
|---|---|---|---|
| `agg_ops_daily` | 1 row per date | Capacity + utilization daily metrics | `metric_date` |
| `kpi_ops` | 1 row per as-of date | 30-day ops KPI summary | `as_of_date` |

### Finance (`fin`)

| Object | Grain | Description | Primary keys / key columns |
|---|---|---|---|
| `snap_mrr` | 1 row per as-of date | Current MRR snapshot | `as_of_date` |
| `agg_revenue_monthly` | 1 row per organization per month | Revenue aggregation | `organization_id`, `revenue_month` |
| `agg_spend_monthly` | 1 row per organization x month x source | Monthly spend by source | `organization_id`, `spend_month`, `spend_source` |
| `agg_vendor_spend_monthly` | 1 row per organization x vendor x month | Vendor-level monthly spend | `organization_id`, `spend_month`, `vendor_name` |
| `agg_budget_vs_actual_monthly` | 1 row per organization per month | Budget vs actual with AP liability | `organization_id`, `budget_month` |

## Metadata and Metric Governance Tables (`core`)

| Object | Purpose | Key fields |
|---|---|---|
| `table_catalog` | Table-level metadata for explorer and agents | `table_key`, `table_schema`, `table_name`, `owner`, `certified`, `column_count`, `freshness_column` |
| `column_catalog` | Column-level metadata for explorer and agents | `table_key`, `column_name`, `data_type`, `ordinal_position`, `sensitivity_class` |
| `metric_registry` | Certified metric definitions and ownership | `metric_name`, `business_definition`, `sql_definition_or_model`, `grain`, `owner`, `freshness_sla`, `version`, `effective_date` |
| `metric_catalog` | Agent/explorer-friendly metric catalog projection | `metric_key`, `metric_name`, `owner`, `certified`, `grain`, `freshness_sla` |
| `lineage_catalog` | Child-parent lineage edges from dbt manifest | `child_object`, `parent_object`, `child_unique_id`, `parent_unique_id` |

## Notes

- Naming convention migration is in progress (see `CLAUDE.md`). Existing tables like `growth_daily` and `growth_kpis` remain active until compatibility views and rename rollout are complete.
- For LLM/agent discovery use:
  - `GET /llm.txt` for policy/contract
  - `GET /api/metadata/llm-context` for compact schema + metric context
