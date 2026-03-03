# BrowserBase Data Platform

This repository contains the BrowserBase analytics/data-platform prototype: source schema + seeding, replication into DuckDB/MotherDuck, and dbt models for warehouse and analytics outputs.

## Repository Layout

- `supabase/` source schema, migrations, and seed scripts
- `pipeline/` replication and orchestration scripts
- `warehouse/` dbt project and models
- `queries/` example SQL queries and checks
- `workflows/` workflow-related assets

## Data Flow

1. Source data is defined/seeded in Supabase.
2. `pipeline/replicate.py` syncs source data into warehouse bronze tables.
3. dbt builds staging/core models in warehouse schemas.
4. dbt builds domain marts in analytics schemas (`growth`, `product`, `finance`, `eng`, `ops`, `core`).

## Environment Setup

1. Copy `env.example` to `.env`.
2. Fill required values for your target backend (local DuckDB and/or MotherDuck).

Important environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `WAREHOUSE_DUCKDB_PATH`
- `ANALYTICS_DUCKDB_PATH`
- `MOTHERDUCK_PATH`
- `MOTHERDUCK_ANALYTICS_PATH`
- `MOTHERDUCK_TOKEN`

## Common Commands

```bash
# Seed GTM/finance/trial scenarios, then run replicate + dbt + tests
./pipeline/run_gtm_workflow.sh

# Apply GTM employee-ownership schema migration (requires valid SUPABASE_DB_* env vars)
psql -v ON_ERROR_STOP=1 -f supabase/migrations/005_gtm_employee_ownership.sql

# Run replication
python3 pipeline/replicate.py

# Run full pipeline helper
./pipeline/run_pipeline.sh

# Run dbt manually
cd warehouse
dbt run
dbt test
```

## Documentation Policy

- Keep root documentation consolidated in this `README.md`.
- Add detailed notes close to the relevant code instead of creating new root-level Markdown files.
