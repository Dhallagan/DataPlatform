# 🚀 Data Pipeline Architecture

## Overview

This project simulates a production data pipeline for a browser infrastructure company:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   SUPABASE      │     │    FIVETRAN     │     │   SNOWFLAKE     │
│   (Postgres)    │ ──▶ │   (Replicate)   │ ──▶ │    (DuckDB)     │
│                 │     │                 │     │                 │
│  App Database   │     │   CDC / Sync    │     │  Data Warehouse │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                               ┌──────────────────────────────────────┐
                               │              dbt                     │
                               │                                      │
                               │  ┌─────────────────────────────────┐ │
                               │  │       Bronze (Raw)              │ │
                               │  │  bronze_supabase.*              │ │
                               │  │  └─ organizations, users, etc   │ │
                               │  └─────────────────────────────────┘ │
                               │               │                      │
                               │               ▼                      │
                               │  ┌─────────────────────────────────┐ │
                               │  │       Silver (Clean)            │ │
                               │  │  silver_stg.*  → silver_core.*  │ │
                               │  │  └─ staging     └─ entities     │ │
                               │  └─────────────────────────────────┘ │
                               │               │                      │
                               │               ▼                      │
                               │  ┌─────────────────────────────────┐ │
                               │  │       Gold (Metrics)            │ │
                               │  │  gold_marts.*  + gold_metrics.* │ │
                               │  │  └─ facts       └─ KPIs         │ │
                               │  └─────────────────────────────────┘ │
                               └──────────────────────────────────────┘
                                                        │
                                                        ▼
                               ┌──────────────────────────────────────┐
                               │              HEX                     │
                               │         (Data Workspace)             │
                               │                                      │
                               │  • Dashboards                        │
                               │  • Ad-hoc Analysis                   │
                               │  • Metric Exploration                │
                               └──────────────────────────────────────┘
```

## Local Simulation

We use **DuckDB** as a local Snowflake stand-in because:
- Free and runs locally
- Supports most Snowflake SQL syntax
- Fast columnar analytics engine
- Perfect for prototyping

## Running the Full Pipeline

Before running, create local env config:

```bash
cp env.example .env
# then fill in SUPABASE_URL and SUPABASE_SERVICE_KEY.
# for MotherDuck, also set MOTHERDUCK_PATH + MOTHERDUCK_TOKEN.
```

### 1. Replicate from Supabase → DuckDB (Bronze)

```bash
cd pipeline
python3 replicate.py
```

This simulates Fivetran/Airbyte by:
- Fetching all tables from Supabase via REST API
- Loading them into DuckDB `bronze_supabase` schema
- Adding `_synced_at` metadata column

### 2. Transform with dbt (Bronze → Silver → Gold)

```bash
cd warehouse
dbt run --target duckdb
```

To use MotherDuck instead:

```bash
cd warehouse
dbt run --target motherduck
```

This runs all dbt models:
- **Staging (stg_*)**: Basic cleaning and typing
- **Core (core_*)**: Business entities with enrichment
- **Marts (fct_*)**: Aggregated facts
- **Metrics (v_*)**: KPI views for consumption

Schema naming note:
- dbt is configured to keep schema names exactly as declared (`silver_stg`, `silver_core`, `gold_marts`, `gold_metrics`) without a `main_` prefix.

### 3. Query the Warehouse

```bash
cd pipeline
python3 query_warehouse.py
```

Or interactively:

```python
import duckdb

conn = duckdb.connect('pipeline/warehouse.duckdb')

# MRR by plan
conn.execute("""
    SELECT * FROM gold_metrics.v_mrr
""").df()

# Active organizations
conn.execute("""
    SELECT * FROM gold_metrics.v_active_organizations
    WHERE activity_tier = 'high_activity'
""").df()

# Daily sessions
conn.execute("""
    SELECT * FROM gold_marts.fct_daily_sessions
    ORDER BY session_date DESC
    LIMIT 30
""").df()
```

## One-Line Full Pipeline

```bash
./pipeline/run_pipeline.sh
```

Use MotherDuck with the one-line runner:

```bash
DBT_TARGET=motherduck ./pipeline/run_pipeline.sh
```

## Medallion Layer Details

### Bronze (Raw)
| Table | Description |
|-------|-------------|
| bronze_supabase.organizations | Raw org data |
| bronze_supabase.users | Raw user data |
| bronze_supabase.browser_sessions | Raw session data |
| bronze_supabase.subscriptions | Raw billing data |
| ... | Other source tables |

### Silver (Staging + Core)
| Model | Description |
|-------|-------------|
| stg_organizations | Cleaned orgs with status flags |
| stg_users | Cleaned users with email domain |
| stg_browser_sessions | Sessions with duration calculated |
| core_organizations | Enriched orgs with lifetime metrics |
| core_users | Enriched users with activity stats |
| core_sessions | Denormalized session + org + user |

### Gold (Marts + Metrics)
| Model | Description |
|-------|-------------|
| fct_daily_sessions | Daily session aggregates per org |
| fct_monthly_revenue | Monthly revenue by org/plan |
| v_mrr | Current MRR snapshot |
| v_active_organizations | Orgs with 30-day activity |
| v_cohort_retention | Weekly cohort retention |
| v_daily_kpis | Executive dashboard metrics |

## Production Deployment

To run against real Snowflake:

1. Update `warehouse/profiles.yml` with Snowflake credentials
2. Set up Fivetran to replicate Supabase → Snowflake
3. Run `dbt run --target snowflake`
4. Connect Hex to Snowflake's gold layer
