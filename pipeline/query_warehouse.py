#!/usr/bin/env python3
"""
Query the DuckDB warehouse - simulates querying Snowflake
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
MOTHERDUCK_TOKEN = os.environ.get("MOTHERDUCK_TOKEN")
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

resolved_path = WAREHOUSE_PATH
if not resolved_path.startswith("md:") and not os.path.isabs(resolved_path):
    resolved_path = os.path.abspath(os.path.join(PROJECT_ROOT, resolved_path))

connection_kwargs = {"read_only": True}
if resolved_path.startswith("md:"):
    if not MOTHERDUCK_TOKEN:
        raise ValueError(
            "WAREHOUSE_DUCKDB_PATH is an md: path but MOTHERDUCK_TOKEN is missing."
        )
    connection_kwargs["config"] = {"motherduck_token": MOTHERDUCK_TOKEN}

conn = duckdb.connect(resolved_path, **connection_kwargs)

def resolve_schema(conn, preferred: str, fallback: str) -> str:
    """Return preferred schema if present, else fallback."""
    result = conn.execute(
        """
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name IN (?, ?)
        ORDER BY CASE WHEN schema_name = ? THEN 0 ELSE 1 END
        LIMIT 1
        """,
        [preferred, fallback, preferred],
    ).fetchone()
    if not result:
        raise RuntimeError(f"Neither schema '{preferred}' nor '{fallback}' exists.")
    return result[0]


gold_metrics_schema = resolve_schema(conn, "gold_metrics", "main_gold_metrics")
gold_marts_schema = resolve_schema(conn, "gold_marts", "main_gold_marts")

print("=" * 70)
print("🏠 BROWSERBASE DATA WAREHOUSE")
print("=" * 70)

# Show schemas (medallion layers)
print("\n📊 SCHEMAS (Medallion Layers)")
print("-" * 70)
schemas = conn.execute("""
    SELECT table_schema, COUNT(*) as tables
    FROM information_schema.tables
    WHERE table_schema LIKE '%bronze%' OR table_schema LIKE '%silver%' OR table_schema LIKE '%gold%'
    GROUP BY table_schema
    ORDER BY table_schema
""").fetchall()

for schema, count in schemas:
    print(f"  {schema:30} {count:>3} objects")

# MRR Summary
print("\n💰 MRR SUMMARY (from gold_metrics.v_mrr)")
print("-" * 70)
mrr = conn.execute(f"""
    SELECT 
        as_of_date,
        total_mrr_usd,
        total_paying_customers,
        arpu_usd
    FROM {gold_metrics_schema}.v_mrr
    LIMIT 1
""").fetchdf()
print(mrr.to_string(index=False))

# Active Organizations
print("\n📈 ACTIVE ORGANIZATIONS (from gold_metrics.v_active_organizations)")
print("-" * 70)
active = conn.execute(f"""
    SELECT 
        current_plan_name as plan,
        COUNT(*) as orgs,
        SUM(lifetime_sessions) as total_sessions,
        SUM(sessions_last_30d) as sessions_30d,
        activity_tier
    FROM {gold_metrics_schema}.v_active_organizations
    GROUP BY current_plan_name, activity_tier
    ORDER BY total_sessions DESC
    LIMIT 10
""").fetchdf()
print(active.to_string(index=False))

# Daily Sessions
print("\n📆 DAILY SESSIONS (from gold_marts.fct_daily_sessions)")
print("-" * 70)
daily = conn.execute(f"""
    SELECT 
        session_date,
        SUM(total_sessions) as total_sessions,
        COUNT(DISTINCT organization_id) as unique_orgs,
        ROUND(AVG(avg_duration_seconds), 0) as avg_seconds
    FROM {gold_marts_schema}.fct_daily_sessions
    GROUP BY session_date
    ORDER BY session_date DESC
    LIMIT 10
""").fetchdf()
print(daily.to_string(index=False))

# Metric Spine (canonical self-serve table)
print("\n🧩 METRIC SPINE (from gold_metrics.metric_spine_daily)")
print("-" * 70)
spine = conn.execute(f"""
    SELECT
        metric_date,
        COUNT(DISTINCT organization_id) AS orgs,
        SUM(runs) AS runs,
        ROUND(AVG(success_rate_pct), 2) AS avg_success_rate_pct,
        ROUND(SUM(mrr_usd), 2) AS mrr_usd
    FROM {gold_metrics_schema}.metric_spine_daily
    GROUP BY metric_date
    ORDER BY metric_date DESC
    LIMIT 10
""").fetchdf()
print(spine.to_string(index=False))

# Cohort Retention
print("\n🔄 COHORT RETENTION (from gold_metrics.v_cohort_retention)")
print("-" * 70)
cohort = conn.execute(f"""
    SELECT *
    FROM {gold_metrics_schema}.v_cohort_retention
    ORDER BY cohort_week DESC, weeks_since_signup
    LIMIT 15
""").fetchdf()
print(cohort.to_string(index=False))

# Growth KPI Snapshot
print("\n🚀 GROWTH KPIS (last 30d)")
print("-" * 70)
growth = conn.execute(f"""
    SELECT *
    FROM {gold_metrics_schema}.v_growth_kpis
    LIMIT 1
""").fetchdf()
print(growth.to_string(index=False))

# Product KPI Snapshot
print("\n🧭 PRODUCT KPIS (last 30d)")
print("-" * 70)
product = conn.execute(f"""
    SELECT *
    FROM {gold_metrics_schema}.v_product_kpis
    LIMIT 1
""").fetchdf()
print(product.to_string(index=False))

# Engineering KPI Snapshot
print("\n🛠️ ENGINEERING KPIS (last 30d)")
print("-" * 70)
engineering = conn.execute(f"""
    SELECT *
    FROM {gold_metrics_schema}.v_engineering_kpis
    LIMIT 1
""").fetchdf()
print(engineering.to_string(index=False))

# Ops KPI Snapshot
print("\n⚙️ OPS KPIS (last 30d)")
print("-" * 70)
ops = conn.execute(f"""
    SELECT *
    FROM {gold_metrics_schema}.v_ops_kpis
    LIMIT 1
""").fetchdf()
print(ops.to_string(index=False))

print("\n" + "=" * 70)
print("✅ Data flowing through: Supabase → Bronze → Silver → Gold")
print("=" * 70)
