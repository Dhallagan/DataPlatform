# Browserbase System Documentation

This file is the single source of truth for the entire system: source setup, replication, warehouse modeling, execution, and troubleshooting.

## 1) System Overview

The repository simulates a production analytics stack for a browser infrastructure platform:

```
Supabase (source Postgres) -> Replication -> Warehouse -> dbt -> BI
                              bronze raw     silver/gold
```

Main idea:

- Supabase stores operational product and billing data
- `pipeline/replicate.py` simulates managed replication (Fivetran/Airbyte-style) into bronze
- dbt builds silver and gold layers in DuckDB or MotherDuck
- Gold metrics are consumed by analytics tools and dashboards

## 2) Repository Map

```text
BrowserBase/
├── SYSTEM_DOCUMENTATION.md
├── env.example
├── docker-compose.yml
├── pipeline/
│   ├── replicate.py
│   ├── query_warehouse.py
│   └── run_pipeline.sh
├── supabase/
│   ├── schema.sql
│   ├── migrations/001_schema.sql
│   ├── seed_data.py
│   ├── seed_supabase.py
│   └── seed.sql
└── warehouse/
    ├── dbt_project.yml
    ├── profiles.yml
    ├── models/
    │   ├── staging/
    │   ├── core/
    │   ├── growth/
    │   ├── product/
    │   ├── finance/
    │   ├── eng/
    │   ├── ops/
    │   └── core_metrics/
    └── tests/
```

## 3) Source Data Domain (Supabase)

### Core domains

- Identity/account: `organizations`, `users`, `organization_members`
- Product usage: `projects`, `api_keys`, `browser_sessions`, `session_events`
- Billing: `plans`, `subscriptions`, `usage_records`, `invoices`
- GTM/CRM: `gtm_accounts`, `gtm_contacts`, `gtm_leads`, `gtm_campaigns`, `gtm_lead_touches`, `gtm_opportunities`, `gtm_activities`

### Schema files

- Local/Postgres bootstrap: `supabase/schema.sql`
- Supabase migration script: `supabase/migrations/001_schema.sql`

## 4) Medallion Architecture

| Layer | Schema | Type | Purpose |
|---|---|---|---|
| Bronze | `bronze_supabase` | Raw replicated tables | Source-aligned raw copy |
| Silver | `silver` | Views + Tables | Cleaning/casting plus canonical entities and facts |
| Domain Analytics | `growth`, `product`, `finance`, `eng`, `ops` | Views + Tables | Team/domain aggregates and KPI models |
| Shared KPI | `core` | Views + Tables | Cross-domain KPI layer and metric spine |

## 5) Model Inventory

### Bronze tables (replicated)

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

### Silver staging models

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

### Silver core models

- `organizations`
- `users`
- `sessions`
- `dim_organizations`
- `dim_users`
- `fct_runs`
- `fct_events`
- `fct_subscriptions`

### Gold marts models

- `daily_sessions`
- `monthly_revenue`
- `growth_daily`
- `product_daily`
- `engineering_daily`
- `ops_daily`

### Gold metrics models/views

- `metric_spine`
- `mrr`
- `active_organizations`
- `daily_kpis`
- `cohort_retention`
- `growth_kpis`
- `product_kpis`
- `engineering_kpis`
- `ops_kpis`

### Growth workflow and GTM models

- `gtm_funnel_daily`
- `gtm_pipeline_snapshot`
- `signal_thresholds`
- `signal_trial_conversion_risk_daily`
- `growth_task_queue`
- `action_log`

## 6) Environment Variables

Defined in `env.example`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `WAREHOUSE_DUCKDB_PATH` (default local warehouse path)
- `MOTHERDUCK_PATH` (optional, `md:` path)
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

Primary downstream objects for BI:

- `core.metric_spine` (canonical org/day metric table)
- `core.daily_kpis`
- `finance.mrr`
- `growth.active_organizations`
- domain KPI snapshots:
  - `growth.growth_kpis`
  - `product.product_kpis`
  - `eng.engineering_kpis`
  - `ops.ops_kpis`

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
