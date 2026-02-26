# Browserbase Data Platform Prototype

A prototype data platform for a browser infrastructure company (modeled after Browserbase).

This demonstrates a complete **Medallion Architecture** implementation:

```
Supabase (Postgres)  →  Bronze  →  Silver  →  Gold  →  Hex/BI
     [Source]          [Raw]     [Clean]   [Metrics]  [Dashboards]
```

## 🏗️ Architecture Overview

### Medallion Layers

| Layer | Schema | Purpose | Materialization |
|-------|--------|---------|-----------------|
| **Bronze** | `bronze_supabase` | Raw replica of Supabase tables | External sync (Fivetran/Airbyte) |
| **Silver - Staging** | `silver_stg` | Cleaned, type-cast, standardized | Views |
| **Silver - Core** | `silver_core` | Canonical entity models | Tables |
| **Gold - Marts** | `gold_marts` | Facts & aggregates | Tables |
| **Gold - Metrics** | `gold_metrics` | Semantic views for BI | Views |

### Entity Model

```
Organizations ──┬── Users
                ├── Projects ── Sessions ── Events
                ├── Subscriptions ── Plans
                ├── API Keys
                └── Invoices
```

### Core Entities

- **`core_organizations`** - The billing entity, enriched with subscription & usage data
- **`core_users`** - Individual users with org membership context
- **`core_sessions`** - Browser sessions (the core product) with derived metrics

### Key Metrics

- **`v_active_organizations`** - Orgs with activity in last 30 days
- **`v_mrr`** - Monthly Recurring Revenue breakdown
- **`v_daily_kpis`** - Daily platform health metrics
- **`v_cohort_retention`** - Weekly retention by signup cohort
- **`v_growth_kpis`** - 30-day growth funnel and active org KPIs
- **`v_product_kpis`** - 30-day product adoption and engagement KPIs
- **`v_engineering_kpis`** - 30-day reliability and latency KPIs
- **`v_ops_kpis`** - 30-day operational capacity and utilization KPIs

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.9+
- dbt-core (optional, for running transforms)

### 1. Start the Database

```bash
# Configure local secrets (never commit .env)
cp env.example .env
# Optional cloud warehouse: set MOTHERDUCK_PATH + MOTHERDUCK_TOKEN in .env

# Generate seed data
cd supabase && python3 seed_data.py

# Start Postgres + Adminer
docker-compose up -d

# Access Adminer UI at http://localhost:8080
# Server: postgres | User: browserbase | Password: browserbase_dev | Database: browserbase
```

### 2. Explore the Data

Connect to Postgres and run queries:

```bash
docker exec -it browserbase_postgres psql -U browserbase
```

Example queries:

```sql
-- Count sessions by status
SELECT status, COUNT(*) 
FROM browser_sessions 
GROUP BY 1;

-- Top organizations by session count
SELECT o.name, COUNT(s.id) as sessions
FROM organizations o
JOIN browser_sessions s ON o.id = s.organization_id
GROUP BY 1
ORDER BY 2 DESC
LIMIT 10;

-- Daily session trends
SELECT DATE(created_at) as day, COUNT(*) 
FROM browser_sessions 
GROUP BY 1 
ORDER BY 1;
```

### 3. Run dbt Models (Optional)

```bash
cd warehouse
pip install dbt-postgres
dbt deps
dbt run
```

## 📊 Data Model Details

### Source Tables (Bronze)

| Table | Description | Key |
|-------|-------------|-----|
| `organizations` | Customer companies | `id` |
| `users` | Individual users | `id` |
| `organization_members` | User ↔ Org mapping | `id` |
| `plans` | Subscription tiers | `id` |
| `subscriptions` | Org subscriptions | `id` |
| `api_keys` | API authentication | `id` |
| `projects` | Logical session groupings | `id` |
| `browser_sessions` | **Core product** - browser instances | `id` |
| `session_events` | Events within sessions | `id` |
| `usage_records` | Monthly usage aggregates | `id` |
| `invoices` | Billing records | `id` |

### Sample Data Stats

- 50 organizations
- ~250 users
- ~10,000 browser sessions
- ~250,000 session events
- 6 months of historical data

## 🎯 Use Cases This Enables

1. **Product Analytics** - Session success rates, feature adoption
2. **Revenue Reporting** - MRR, ARPU, churn analysis
3. **Growth Metrics** - Signups, activation, retention cohorts
4. **Operational Monitoring** - Error rates, timeout trends
5. **Customer Health** - Activity tiers, usage patterns

## 📁 Project Structure

```
BrowserBase/
├── docker-compose.yml      # Local Postgres + Adminer
├── supabase/
│   ├── schema.sql          # Database schema
│   ├── seed_data.py        # Sample data generator
│   └── seed.sql            # Generated INSERT statements
└── warehouse/
    ├── dbt_project.yml     # dbt configuration
    ├── profiles.yml        # Connection profiles
    └── models/
        ├── staging/        # Silver - Cleaned sources
        │   ├── _sources.yml
        │   ├── stg_organizations.sql
        │   ├── stg_users.sql
        │   ├── stg_browser_sessions.sql
        │   ├── stg_subscriptions.sql
        │   └── stg_plans.sql
        ├── core/           # Silver - Entity models
        │   ├── core_organizations.sql
        │   ├── core_users.sql
        │   └── core_sessions.sql
        ├── marts/          # Gold - Facts
        │   ├── fct_daily_sessions.sql
        │   ├── fct_monthly_revenue.sql
        │   ├── growth/fct_growth_daily.sql
        │   ├── product/fct_product_daily.sql
        │   ├── engineering/fct_engineering_daily.sql
        │   └── ops/fct_ops_daily.sql
        └── metrics/        # Gold - Semantic layer
            ├── v_active_organizations.sql
            ├── v_mrr.sql
            ├── v_daily_kpis.sql
            ├── v_cohort_retention.sql
            ├── v_growth_kpis.sql
            ├── v_product_kpis.sql
            ├── v_engineering_kpis.sql
            └── v_ops_kpis.sql
```

## 🔑 Key Concepts Demonstrated

### 1. Entity Thinking (Not Tables)

Instead of exposing raw tables, we model **business entities**:
- A `core_organization` is one row per organization with all relevant context
- A `core_session` enriches raw sessions with derived metrics

### 2. Canonical Metrics

Metrics like "active organization" have **one definition**:
- `v_active_organizations` = orgs with ≥1 session in last 30 days
- All dashboards reference this single source of truth

### 3. Grain Discipline

Every table has a clear grain:
- `fct_daily_sessions` = 1 row per org per day
- `core_users` = 1 row per user

### 4. Layered Testing

Tests cascade through layers:
- Bronze: schema validation, freshness
- Silver: uniqueness, not-null, referential integrity
- Gold: business logic validation

---

Built as a prototype for demonstrating founding data hire capabilities.
