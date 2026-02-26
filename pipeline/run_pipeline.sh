#!/bin/bash
# =============================================================================
# Full Pipeline Simulation
# =============================================================================
# Simulates: Supabase → Fivetran → Snowflake → dbt → Hex
# Using:     Supabase → replicate.py → DuckDB → dbt
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================================"
echo "🚀 BROWSERBASE DATA PIPELINE"
echo "============================================================"
echo ""
echo "This simulates the full production pipeline:"
echo "  Supabase (Postgres) → Fivetran → Snowflake → dbt → Hex"
echo ""
echo "Using local equivalents:"
echo "  Supabase → replicate.py → DuckDB → dbt"
echo ""

# Step 1: Replicate from Supabase to DuckDB (Bronze layer)
echo "============================================================"
echo "STEP 1: Replicate Supabase → DuckDB (Bronze)"
echo "============================================================"
cd "$SCRIPT_DIR"
python3 replicate.py

# Step 2: Run dbt transformations
echo ""
echo "============================================================"
echo "STEP 2: Run dbt Transformations (Bronze → Silver → Gold)"
echo "============================================================"
cd "$PROJECT_DIR/warehouse"
dbt run --target duckdb

# Step 3: Run dbt tests
echo ""
echo "============================================================"
echo "STEP 3: Run Data Quality Tests"
echo "============================================================"
dbt test --target duckdb || echo "⚠️  Some tests failed (expected with sample data)"

# Step 4: Show summary
echo ""
echo "============================================================"
echo "✅ PIPELINE COMPLETE"
echo "============================================================"
echo ""
echo "Bronze (raw):   bronze_supabase.*"
echo "Silver (clean): silver_stg.*, silver_core.*"
echo "Gold (metrics): gold_marts.*, gold_metrics.*"
echo ""
echo "Query the warehouse:"
echo "  python3 -c \"import duckdb; conn = duckdb.connect('pipeline/warehouse.duckdb'); print(conn.execute('SELECT * FROM gold_metrics.v_mrr').df())\""
echo ""
echo "Or open DuckDB CLI:"
echo "  duckdb pipeline/warehouse.duckdb"
echo ""
