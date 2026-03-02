#!/usr/bin/env python3
"""
Query the warehouse and analytics databases.
"""
import os
import duckdb
from tabulate import tabulate

def load_dotenv_if_present():
    """Load a .env file from project root or pipeline dir into process env."""
    search_paths = [
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        os.path.join(os.path.dirname(__file__), ".env"),
    ]

    for env_path in search_paths:
        env_path = os.path.abspath(env_path)
        if not os.path.exists(env_path):
            continue

        with open(env_path, "r", encoding="utf-8") as env_file:
            for raw_line in env_file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)
        break


load_dotenv_if_present()

WAREHOUSE_PATH = os.environ.get(
    "WAREHOUSE_DUCKDB_PATH",
    os.environ.get(
        "MOTHERDUCK_PATH",
        os.path.join(os.path.dirname(__file__), "warehouse.duckdb")
    )
)
ANALYTICS_PATH = os.environ.get(
    "ANALYTICS_DUCKDB_PATH",
    os.path.join(os.path.dirname(__file__), "analytics.duckdb")
)
MOTHERDUCK_TOKEN = os.environ.get("MOTHERDUCK_TOKEN")
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

resolved_path = WAREHOUSE_PATH
if not resolved_path.startswith("md:") and not os.path.isabs(resolved_path):
    resolved_path = os.path.abspath(os.path.join(PROJECT_ROOT, resolved_path))

resolved_analytics = ANALYTICS_PATH
if not resolved_analytics.startswith("md:") and not os.path.isabs(resolved_analytics):
    resolved_analytics = os.path.abspath(os.path.join(PROJECT_ROOT, resolved_analytics))

connection_kwargs = {"read_only": True}
if resolved_path.startswith("md:"):
    if not MOTHERDUCK_TOKEN:
        raise ValueError(
            "WAREHOUSE_DUCKDB_PATH is an md: path but MOTHERDUCK_TOKEN is missing."
        )
    connection_kwargs["config"] = {"motherduck_token": MOTHERDUCK_TOKEN}

conn = duckdb.connect(resolved_path, **connection_kwargs)

# Attach analytics database
if os.path.exists(resolved_analytics) or resolved_analytics.startswith("md:"):
    try:
        conn.execute(f"ATTACH '{resolved_analytics}' AS analytics (READ_ONLY)")
    except Exception:
        pass  # May already be attached or not exist yet


print("=" * 70)
print("BROWSERBASE DATA WAREHOUSE")
print("=" * 70)

# Show schemas across both databases
print("\nSCHEMAS")
print("-" * 70)
schemas = conn.execute("""
    SELECT table_catalog AS database, table_schema, COUNT(*) as tables
    FROM information_schema.tables
    WHERE table_schema NOT IN ('information_schema', 'main')
    GROUP BY table_catalog, table_schema
    ORDER BY table_catalog, table_schema
""").fetchall()

for db, schema, count in schemas:
    print(f"  {db}.{schema:30} {count:>3} objects")

# MRR Summary
print("\nMRR SUMMARY (analytics.finance.mrr)")
print("-" * 70)
try:
    mrr = conn.execute("""
        SELECT
            as_of_date,
            total_mrr_usd,
            total_paying_customers,
            arpu_usd
        FROM analytics.finance.mrr
        LIMIT 1
    """).fetchdf()
    print(mrr.to_string(index=False))
except Exception as e:
    print(f"  (not available: {e})")

# Active Organizations
print("\nACTIVE ORGANIZATIONS (analytics.growth.active_organizations)")
print("-" * 70)
try:
    active = conn.execute("""
        SELECT
            current_plan_name as plan,
            COUNT(*) as orgs,
            SUM(lifetime_sessions) as total_sessions,
            SUM(sessions_last_30d) as sessions_30d,
            activity_tier
        FROM analytics.growth.active_organizations
        GROUP BY current_plan_name, activity_tier
        ORDER BY total_sessions DESC
        LIMIT 10
    """).fetchdf()
    print(active.to_string(index=False))
except Exception as e:
    print(f"  (not available: {e})")

# Daily Sessions
print("\nDAILY SESSIONS (analytics.product.daily_sessions)")
print("-" * 70)
try:
    daily = conn.execute("""
        SELECT
            session_date,
            SUM(total_sessions) as total_sessions,
            COUNT(DISTINCT organization_id) as unique_orgs,
            ROUND(AVG(avg_duration_seconds), 0) as avg_seconds
        FROM analytics.product.daily_sessions
        GROUP BY session_date
        ORDER BY session_date DESC
        LIMIT 10
    """).fetchdf()
    print(daily.to_string(index=False))
except Exception as e:
    print(f"  (not available: {e})")

# Metric Spine
print("\nMETRIC SPINE (analytics.core.metric_spine)")
print("-" * 70)
try:
    spine = conn.execute("""
        SELECT
            metric_date,
            COUNT(DISTINCT organization_id) AS orgs,
            SUM(runs) AS runs,
            ROUND(AVG(success_rate_pct), 2) AS avg_success_rate_pct,
            ROUND(SUM(mrr_usd), 2) AS mrr_usd
        FROM analytics.core.metric_spine
        GROUP BY metric_date
        ORDER BY metric_date DESC
        LIMIT 10
    """).fetchdf()
    print(spine.to_string(index=False))
except Exception as e:
    print(f"  (not available: {e})")

# Cohort Retention
print("\nCOHORT RETENTION (analytics.growth.cohort_retention)")
print("-" * 70)
try:
    cohort = conn.execute("""
        SELECT *
        FROM analytics.growth.cohort_retention
        ORDER BY cohort_week DESC, weeks_since_signup
        LIMIT 15
    """).fetchdf()
    print(cohort.to_string(index=False))
except Exception as e:
    print(f"  (not available: {e})")

# Growth KPI Snapshot
print("\nGROWTH KPIS (last 30d)")
print("-" * 70)
try:
    growth = conn.execute("""
        SELECT * FROM analytics.growth.growth_kpis LIMIT 1
    """).fetchdf()
    print(growth.to_string(index=False))
except Exception as e:
    print(f"  (not available: {e})")

# Product KPI Snapshot
print("\nPRODUCT KPIS (last 30d)")
print("-" * 70)
try:
    product = conn.execute("""
        SELECT * FROM analytics.product.product_kpis LIMIT 1
    """).fetchdf()
    print(product.to_string(index=False))
except Exception as e:
    print(f"  (not available: {e})")

# Engineering KPI Snapshot
print("\nENGINEERING KPIS (last 30d)")
print("-" * 70)
try:
    engineering = conn.execute("""
        SELECT * FROM analytics.eng.engineering_kpis LIMIT 1
    """).fetchdf()
    print(engineering.to_string(index=False))
except Exception as e:
    print(f"  (not available: {e})")

# Ops KPI Snapshot
print("\nOPS KPIS (last 30d)")
print("-" * 70)
try:
    ops = conn.execute("""
        SELECT * FROM analytics.ops.ops_kpis LIMIT 1
    """).fetchdf()
    print(ops.to_string(index=False))
except Exception as e:
    print(f"  (not available: {e})")

print("\n" + "=" * 70)
print("Data flow: Supabase -> Bronze -> Silver -> Analytics")
print("=" * 70)
