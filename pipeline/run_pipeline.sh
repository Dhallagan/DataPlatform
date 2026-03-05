#!/bin/bash
# =============================================================================
# Full Pipeline Simulation
# =============================================================================
# Simulates: Supabase -> Fivetran -> Snowflake -> dbt -> Hex
# Using:     Supabase -> replicate.py -> DuckDB -> dbt
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

# Ensure local DuckDB path resolves correctly even after `cd warehouse`.
if [ "$DBT_TARGET" = "duckdb" ]; then
  WAREHOUSE_DUCKDB_PATH="${WAREHOUSE_DUCKDB_PATH:-/tmp/browserbase_warehouse.duckdb}"

  if [[ "$WAREHOUSE_DUCKDB_PATH" != /* ]] && [[ "$WAREHOUSE_DUCKDB_PATH" != md:* ]]; then
    WAREHOUSE_DUCKDB_PATH="$PROJECT_DIR/${WAREHOUSE_DUCKDB_PATH#./}"
  fi

  export WAREHOUSE_DUCKDB_PATH
fi

echo "============================================================"
echo "BROWSERBASE DATA PIPELINE"
echo "============================================================"
echo ""
echo "This simulates the full production pipeline:"
echo "  Supabase (Postgres) -> Fivetran -> Snowflake -> dbt -> Hex"
echo ""
echo "Using local equivalents:"
echo "  Supabase -> replicate.py -> DuckDB/MotherDuck -> dbt ($DBT_TARGET)"
echo ""

# Step 1: Replicate from Supabase to DuckDB / MotherDuck (Bronze layer)
echo "============================================================"
echo "STEP 1: Replicate Supabase -> DuckDB/MotherDuck (Bronze)"
echo "============================================================"
cd "$SCRIPT_DIR"
python3 replicate.py

# Step 2: Run dbt transformations
echo ""
echo "============================================================"
echo "STEP 2: Build Metadata Catalog Seeds from dbt Artifacts"
echo "============================================================"
cd "$PROJECT_DIR/warehouse"
dbt parse --target "$DBT_TARGET"
cd "$PROJECT_DIR"
python3 pipeline/ingest_metadata_catalog.py
cd "$PROJECT_DIR/warehouse"
dbt seed --target "$DBT_TARGET" --select metadata_lineage_catalog dim_time_seed
cd "$PROJECT_DIR"
python3 pipeline/check_schema_contracts.py

# Step 3: Run dbt transformations
echo ""
echo "============================================================"
echo "STEP 3: Run dbt Transformations (Bronze -> Silver -> Gold)"
echo "============================================================"
cd "$PROJECT_DIR/warehouse"
dbt run --target "$DBT_TARGET"

# Step 4: Run workflow actions (Signal -> Task -> Action Log)
echo ""
echo "============================================================"
echo "STEP 4: Execute Growth Workflow Worker"
echo "============================================================"
cd "$PROJECT_DIR/pipeline"
python3 run_growth_task_worker.py

# Step 5: Run dbt tests
echo ""
echo "============================================================"
echo "STEP 5: Run Data Quality Tests"
echo "============================================================"
cd "$PROJECT_DIR/warehouse"
if [ "${ALLOW_TEST_FAILURES:-false}" = "true" ]; then
  dbt test --target "$DBT_TARGET" || echo "Tests failed but ALLOW_TEST_FAILURES=true"
else
  dbt test --target "$DBT_TARGET"
fi

# Step 6: Freshness gate
echo ""
echo "============================================================"
echo "STEP 6: Run Freshness Gate"
echo "============================================================"
cd "$PROJECT_DIR"
python3 pipeline/check_freshness.py

# Summary
echo ""
echo "============================================================"
echo "PIPELINE COMPLETE"
echo "============================================================"
echo ""
echo "bronze_supabase.*            (raw replicated data)"
echo "silver.*                     (staging + core canonical models)"
echo "{gtm,pro,fin,eng,ops,core}.* (domain-scoped gold models)"
echo ""
echo "Query the warehouse:"
echo "  WAREHOUSE_DUCKDB_PATH=<path-or-md:db> python3 pipeline/query_warehouse.py"
echo ""
echo "Or open DuckDB CLI:"
echo "  duckdb \${WAREHOUSE_DUCKDB_PATH:-/tmp/browserbase_warehouse.duckdb}"
echo ""
