#!/bin/bash
# =============================================================================
# GTM Analytics Workflow Runner
# =============================================================================
# Runs deterministic seeders + full pipeline build/tests.
#
# Usage:
#   ./pipeline/run_gtm_workflow.sh
# =============================================================================

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

echo "============================================================"
echo "STEP 0: Seed Supabase domains"
echo "============================================================"
python3 "$PROJECT_DIR/supabase/seed_gtm_supabase.py"
python3 "$PROJECT_DIR/supabase/seed_finance_supabase.py"
python3 "$PROJECT_DIR/supabase/seed_trial_signal_scenarios.py"

echo ""
echo "============================================================"
echo "STEP 1+: Run full data pipeline"
echo "============================================================"
"$PROJECT_DIR/pipeline/run_pipeline.sh"
