# Browserbase System Documentation

This file is the single source of truth for the entire system: source setup, replication, warehouse modeling, execution, and troubleshooting.

## 1) System Overview

The repository simulates a production analytics stack for a browser infrastructure platform:

```
Supabase (source Postgres) -> Replication -> Warehouse DB -> dbt -> Analytics DB -> BI
                               bronze         silver          domain schemas
```

Main idea:

- Supabase stores operational product and billing data
- `pipeline/replicate.py` simulates managed replication (Fivetran/Airbyte-style) into bronze
- dbt builds silver models in the warehouse database and analytics models in a separate analytics database
- Analytics database has division schemas consumed by teams and dashboards

## 2) Database Layout

Two databases:

| Database | Purpose | Audience |
|---|---|---|
| `warehouse` | Landing + transformation (plumbing) | Data team |
| `analytics` | Division-scoped metrics and KPIs | Analysts, BI tools |

### Warehouse DB schemas

| Schema | Purpose |
|---|---|
| `bronze_supabase` | Raw replicated tables from Supabase app + GTM sources |
| `silver` | Staging views + core entities, facts, dimensions |

### Analytics DB schemas

| Schema | Purpose |
|---|---|
| `growth` | Growth team metrics: signups, activation, retention |
| `product` | Product metrics: sessions, engagement, adoption |
| `finance` | Revenue metrics: MRR, invoices |
| `eng` | Engineering metrics: reliability, latency |
| `ops` | Operations metrics: capacity, throughput |
| `core` | Cross-cutting KPIs: metric spine, daily dashboard |

## 3) Repository Map

```text
BrowserBase/
├── SYSTEM_DOCUMENTATION.md
├── env.example
├── docker-compose.yml
├── pipeline/
│   ├── replicate.py
│   ├── query_warehouse.py
│   └── run_pipeline.sh
├── queries/
│   ├── analytics_queries.sql
│   └── reconciliation_reports.sql
├── supabase/
│   ├── schema.sql
│   ├── migrations/001_schema.sql
│   ├── seed_data.py
│   ├── seed_supabase.py
│   └── seed.sql
└── warehouse/
    ├── dbt_project.yml
    ├── profiles.yml
    ├── macros/
    │   ├── generate_schema_name.sql
    │   └── generate_database_name.sql
    └── models/
        ├── staging/        → warehouse.silver (views)
        ├── core/           → warehouse.silver (tables)
        ├── growth/         → analytics.growth
        ├── product/        → analytics.product
        ├── finance/        → analytics.finance
        ├── eng/            → analytics.eng
        ├── ops/            → analytics.ops
        └── core_metrics/   → analytics.core
```

## 4) Source Data Domain (Supabase)

### Core domains

- Identity/account: `organizations`, `users`, `organization_members`
- Product usage: `projects`, `api_keys`, `browser_sessions`, `session_events`
- Billing: `plans`, `subscriptions`, `usage_records`, `invoices`
- GTM/CRM: `gtm_accounts`, `gtm_contacts`, `gtm_leads`, `gtm_campaigns`, `gtm_lead_touches`, `gtm_opportunities`, `gtm_activities`

### Schema files

- Local/Postgres bootstrap: `supabase/schema.sql`
- Supabase migration script: `supabase/migrations/001_schema.sql`

## 5) Model Inventory

### Bronze tables (replicated into warehouse.bronze_supabase)

- `plans`
- `organizations`
- `users`
- `organization_members`
- `subscriptions`
- `api_keys`
- `projects`
- `browser_sessions`
- `session_events`
- `usage_records`
- `invoices`
- `gtm_accounts`
- `gtm_contacts`
- `gtm_leads`
- `gtm_campaigns`
- `gtm_lead_touches`
- `gtm_opportunities`
- `gtm_activities`

### Silver staging models (warehouse.silver, views)

- `stg_organizations`
- `stg_users`
- `stg_plans`
- `stg_subscriptions`
- `stg_sessions`
- `stg_gtm_accounts`
- `stg_gtm_contacts`
- `stg_gtm_leads`
- `stg_gtm_campaigns`
- `stg_gtm_lead_touches`
- `stg_gtm_opportunities`
- `stg_gtm_activities`

### Silver core models (warehouse.silver, tables)

- `organizations` — canonical org entity with subscription + usage context
- `users` — canonical user entity with org context
- `sessions` — canonical session entity with derived metrics
- `dim_organizations` — org dimension for semantic joins
- `dim_users` — user dimension for semantic joins
- `fct_runs` — browser run fact
- `fct_events` — event fact
- `fct_subscriptions` — subscription fact

### Analytics — growth schema

- `growth_daily` — daily growth funnel and activation trends
- `growth_kpis` — 30-day growth KPI summary
- `cohort_retention` — weekly signup cohort retention
- `active_organizations` — orgs with sessions in last 30 days
- `gtm_funnel_daily` — GTM lead/account/opportunity funnel by day
- `gtm_pipeline_snapshot` — current GTM pipeline coverage and value
- `signal_thresholds` — configured routing thresholds for growth signals
- `signal_trial_conversion_risk_daily` — trial conversion risk scoring at org/day grain
- `growth_task_queue` — prioritized growth tasks generated from signals
- `action_log` — auditable action logging schema for downstream automation

### Analytics — product schema

- `daily_sessions` — daily session aggregates per org
- `product_daily` — daily product engagement and adoption
- `product_kpis` — 30-day product KPI summary

### Analytics — finance schema

- `mrr` — current MRR snapshot
- `monthly_revenue` — monthly revenue per org

### Analytics — eng schema

- `engineering_daily` — daily reliability and latency metrics
- `engineering_kpis` — 30-day engineering KPI summary

### Analytics — ops schema

- `ops_daily` — daily capacity and utilization
- `ops_kpis` — 30-day ops KPI summary

### Analytics — core schema

- `metric_spine` — canonical org x day metric table
- `daily_kpis` — daily executive KPI rollup

## 6) Environment Variables

Defined in `env.example`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `WAREHOUSE_DUCKDB_PATH` (default local warehouse path)
- `ANALYTICS_DUCKDB_PATH` (default local analytics path)
- `MOTHERDUCK_PATH` (optional, `md:` path for warehouse)
- `MOTHERDUCK_ANALYTICS_PATH` (optional, `md:` path for analytics)
- `MOTHERDUCK_TOKEN` (required when using MotherDuck)
- `SUPABASE_DB_HOST` (optional dbt supabase target)
- `SUPABASE_DB_PORT`
- `SUPABASE_DB_USER`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_DB_NAME`
- `SUPABASE_DB_SCHEMA`

## 7) Setup Paths

### A) Full end-to-end pipeline (recommended)

Use Supabase as source, replicate to DuckDB/MotherDuck, then run dbt.

1. Configure environment:

```bash
cp env.example .env
```

2. Set at minimum in `.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

3. Run:

```bash
./pipeline/run_pipeline.sh
```

Use MotherDuck target:

```bash
DBT_TARGET=motherduck ./pipeline/run_pipeline.sh
```

### B) Local Postgres sandbox (quick local data exploration)

```bash
cp env.example .env
cd supabase && python3 seed_data.py && cd ..
docker-compose up -d
```

Then query local source:

- Adminer: `http://localhost:8080`
- psql: `docker exec -it browserbase_postgres psql -U browserbase -d browserbase`

Note: Docker init scripts load `supabase/schema.sql` and `supabase/seed.sql` only when volume is first created.

## 8) Supabase Bootstrap Procedure

### Step 1: Create project

Create a new Supabase project in the dashboard and save credentials.

### Step 2: Apply schema migration

Run contents of `supabase/migrations/001_schema.sql` in SQL Editor.

### Step 3: Seed data via API (recommended)

```bash
cd /Users/dylan/Development/BrowserBase/supabase
pip install supabase python-dotenv

export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-role-key"

python seed_supabase.py --yes
```

Seeder notes:

- Inserts tables in foreign-key-safe order
- `session_events` insert is capped to 10,000 rows for practical runtime

### Step 4: Verify row counts

```sql
SELECT 'plans' AS table_name, COUNT(*) FROM plans
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL SELECT 'browser_sessions', COUNT(*) FROM browser_sessions
UNION ALL SELECT 'session_events', COUNT(*) FROM session_events
UNION ALL SELECT 'usage_records', COUNT(*) FROM usage_records
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices;
```

Expected ranges:

- `plans`: 4
- `organizations`: 50
- `users`: variable (~100-400)
- `browser_sessions`: variable (typically several thousand)
- `session_events`: 10,000 (seeder cap)

## 9) Pipeline Execution Details

### One-command execution

```bash
./pipeline/run_pipeline.sh
```

What it does:

1. Loads `.env`
2. Runs replication (`pipeline/replicate.py`)
3. Runs dbt transforms (`dbt run`)
4. Runs dbt tests (`dbt test`)

### Manual execution

Replication:

```bash
python3 pipeline/replicate.py
```

dbt transforms:

```bash
cd warehouse
dbt run --target duckdb
```

dbt tests:

```bash
cd warehouse
dbt test --target duckdb
```

Warehouse query snapshot:

```bash
python3 pipeline/query_warehouse.py
```

## 10) Data Quality and Testing

Quality coverage includes:

- Source-level constraints in `warehouse/models/staging/_sources.yml`
- Model-level tests in `warehouse/models/*/*.yml`
- Additional SQL tests in `warehouse/tests/`

Typical checks:

- uniqueness and not-null on primary keys and grains
- accepted status values for enums
- relationship integrity across semantic models
- business-rule bounds for KPIs and rates

## 11) Consumption Layer

Analysts connect to the `analytics` database. Primary objects:

**Core:**
- `analytics.core.metric_spine` (canonical org/day metric table)
- `analytics.core.daily_kpis`

**Growth:**
- `analytics.growth.active_organizations`
- `analytics.growth.cohort_retention`
- `analytics.growth.growth_daily`
- `analytics.growth.growth_kpis`
- `analytics.growth.gtm_funnel_daily`
- `analytics.growth.gtm_pipeline_snapshot`
- `analytics.growth.signal_trial_conversion_risk_daily`
- `analytics.growth.growth_task_queue`

**Product:**
- `analytics.product.daily_sessions`
- `analytics.product.product_daily`
- `analytics.product.product_kpis`

**Finance:**
- `analytics.finance.mrr`
- `analytics.finance.monthly_revenue`

**Engineering:**
- `analytics.eng.engineering_daily`
- `analytics.eng.engineering_kpis`

**Operations:**
- `analytics.ops.ops_daily`
- `analytics.ops.ops_kpis`

## 12) Troubleshooting

### Missing replication credentials

- Ensure `.env` exists at repo root
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Use service role key, not anon key

### MotherDuck connection errors

- If warehouse path starts with `md:`, set `MOTHERDUCK_TOKEN`

### dbt target/config issues

- Confirm target exists in `warehouse/profiles.yml`
- For supabase target, ensure all `SUPABASE_DB_*` env vars are set

### Local seed/schema not updating in Docker

Recreate the volume:

```bash
docker-compose down -v
docker-compose up -d
```

### Seeder conflicts in Supabase

- Partial inserts can cause unique constraint conflicts
- Recreate project or truncate tables before rerunning

## 13) Production Adaptation Notes

To move from prototype to production:

1. Replace script replication with managed CDC (Fivetran/Airbyte)
2. Run dbt on production warehouse target (e.g., Snowflake)
3. Schedule orchestrated runs (Dagster/Airflow/Cron/GitHub Actions)
4. Add monitoring for freshness, failures, and test regressions
5. Apply governance controls (access patterns, lineage, SLAs)
