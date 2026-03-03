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
DOTENV_PATH="$PROJECT_DIR/.env"

if [ -f "$DOTENV_PATH" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$DOTENV_PATH"
  set +a
fi

DBT_TARGET="${DBT_TARGET:-duckdb}"
if [ "$DBT_TARGET" = "motherduck" ] && [ -n "${MOTHERDUCK_PATH:-}" ]; then
  export WAREHOUSE_DUCKDB_PATH="$MOTHERDUCK_PATH"
fi

# Ensure local DuckDB paths resolve correctly even after `cd warehouse`.
if [ "$DBT_TARGET" = "duckdb" ]; then
  WAREHOUSE_DUCKDB_PATH="${WAREHOUSE_DUCKDB_PATH:-/tmp/browserbase_warehouse.duckdb}"
  ANALYTICS_DUCKDB_PATH="${ANALYTICS_DUCKDB_PATH:-/tmp/browserbase_analytics.duckdb}"

  if [[ "$WAREHOUSE_DUCKDB_PATH" != /* ]] && [[ "$WAREHOUSE_DUCKDB_PATH" != md:* ]]; then
    WAREHOUSE_DUCKDB_PATH="$PROJECT_DIR/${WAREHOUSE_DUCKDB_PATH#./}"
  fi
  if [[ "$ANALYTICS_DUCKDB_PATH" != /* ]] && [[ "$ANALYTICS_DUCKDB_PATH" != md:* ]]; then
    ANALYTICS_DUCKDB_PATH="$PROJECT_DIR/${ANALYTICS_DUCKDB_PATH#./}"
  fi

  export WAREHOUSE_DUCKDB_PATH
  export ANALYTICS_DUCKDB_PATH
fi

echo "============================================================"
echo "🚀 BROWSERBASE DATA PIPELINE"
echo "============================================================"
echo ""
echo "This simulates the full production pipeline:"
echo "  Supabase (Postgres) → Fivetran → Snowflake → dbt → Hex"
echo ""
echo "Using local equivalents:"
echo "  Supabase → replicate.py → DuckDB/MotherDuck → dbt ($DBT_TARGET)"
echo ""

# Step 1: Replicate from Supabase to DuckDB / MotherDuck (Bronze layer)
echo "============================================================"
echo "STEP 1: Replicate Supabase → DuckDB/MotherDuck (Bronze)"
echo "============================================================"
cd "$SCRIPT_DIR"
python3 replicate.py

# Step 2: Run dbt transformations
echo ""
echo "============================================================"
echo "STEP 2: Run dbt Transformations (Bronze → Silver → Gold)"
echo "============================================================"
cd "$PROJECT_DIR/warehouse"
dbt run --target "$DBT_TARGET"

# Step 3: Run workflow actions (Signal -> Task -> Action Log)
echo ""
echo "============================================================"
echo "STEP 3: Execute Growth Workflow Worker"
echo "============================================================"
cd "$PROJECT_DIR/pipeline"
python3 run_growth_task_worker.py

# Step 4: Run dbt tests
echo ""
echo "============================================================"
echo "STEP 4: Run Data Quality Tests"
echo "============================================================"
cd "$PROJECT_DIR/warehouse"
if [ "${ALLOW_TEST_FAILURES:-false}" = "true" ]; then
  dbt test --target "$DBT_TARGET" || echo "⚠️  Tests failed but ALLOW_TEST_FAILURES=true"
else
  dbt test --target "$DBT_TARGET"
fi

# Step 5: Show summary
echo ""
echo "============================================================"
echo "✅ PIPELINE COMPLETE"
echo "============================================================"
echo ""
echo "warehouse.bronze_supabase.*  (raw replicated data)"
echo "warehouse.silver.*           (staging + core models)"
echo "analytics.{growth,product,finance,eng,ops,core}.*  (analyst-facing)"
echo ""
echo "Query the warehouse:"
echo "  WAREHOUSE_DUCKDB_PATH=<path-or-md:db> python3 pipeline/query_warehouse.py"
echo ""
echo "Or open DuckDB CLI:"
echo "  duckdb \${WAREHOUSE_DUCKDB_PATH:-/tmp/browserbase_warehouse.duckdb}"
echo ""
