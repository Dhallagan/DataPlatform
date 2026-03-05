#!/bin/bash
# Refresh central metadata catalog from dbt artifacts.

set -euo pipefail

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
# All schemas live in a single database — no separate aliases needed.

echo "============================================================"
echo "METADATA CATALOG REFRESH"
echo "============================================================"

echo ""
echo "Step 1: Parse dbt graph"
cd "$PROJECT_DIR/warehouse"
dbt parse --target "$DBT_TARGET"

echo ""
echo "Step 2: Generate lineage seed from manifest"
cd "$PROJECT_DIR"
python3 pipeline/ingest_metadata_catalog.py

echo ""
echo "Step 3: Seed lineage catalog"
cd "$PROJECT_DIR/warehouse"
dbt seed --target "$DBT_TARGET" --select metadata_lineage_catalog

echo ""
echo "Step 4: Build catalog models"
dbt run --target "$DBT_TARGET" --select core_metrics.table_catalog core_metrics.column_catalog core_metrics.metric_registry core_metrics.metric_catalog core_metrics.lineage_catalog

echo ""
echo "Step 5: Validate catalog model tests"
dbt test --target "$DBT_TARGET" --select core_metrics.table_catalog core_metrics.column_catalog core_metrics.metric_registry core_metrics.metric_catalog core_metrics.lineage_catalog

echo ""
echo "✅ Metadata catalog refresh complete"
