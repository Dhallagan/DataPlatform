#!/usr/bin/env python3
"""
Query the DuckDB warehouse - simulates querying Snowflake
"""
import os
import duckdb
from tabulate import tabulate

WAREHOUSE_PATH = os.path.join(os.path.dirname(__file__), "warehouse.duckdb")

conn = duckdb.connect(WAREHOUSE_PATH, read_only=True)

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
mrr = conn.execute("""
    SELECT 
        as_of_date,
        total_mrr_usd,
        total_paying_customers,
        arpu_usd
    FROM main_gold_metrics.v_mrr
    LIMIT 1
""").fetchdf()
print(mrr.to_string(index=False))

# Active Organizations
print("\n📈 ACTIVE ORGANIZATIONS (from gold_metrics.v_active_organizations)")
print("-" * 70)
active = conn.execute("""
    SELECT 
        current_plan_name as plan,
        COUNT(*) as orgs,
        SUM(lifetime_sessions) as total_sessions,
        SUM(sessions_last_30d) as sessions_30d,
        activity_tier
    FROM main_gold_metrics.v_active_organizations
    GROUP BY current_plan_name, activity_tier
    ORDER BY total_sessions DESC
    LIMIT 10
""").fetchdf()
print(active.to_string(index=False))

# Daily Sessions
print("\n📆 DAILY SESSIONS (from gold_marts.fct_daily_sessions)")
print("-" * 70)
daily = conn.execute("""
    SELECT 
        session_date,
        SUM(total_sessions) as total_sessions,
        COUNT(DISTINCT organization_id) as unique_orgs,
        ROUND(AVG(avg_duration_seconds), 0) as avg_seconds
    FROM main_gold_marts.fct_daily_sessions
    GROUP BY session_date
    ORDER BY session_date DESC
    LIMIT 10
""").fetchdf()
print(daily.to_string(index=False))

# Cohort Retention
print("\n🔄 COHORT RETENTION (from gold_metrics.v_cohort_retention)")
print("-" * 70)
cohort = conn.execute("""
    SELECT *
    FROM main_gold_metrics.v_cohort_retention
    ORDER BY cohort_week DESC, weeks_since_signup
    LIMIT 15
""").fetchdf()
print(cohort.to_string(index=False))

print("\n" + "=" * 70)
print("✅ Data flowing through: Supabase → Bronze → Silver → Gold")
print("=" * 70)
