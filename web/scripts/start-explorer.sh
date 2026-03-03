#!/usr/bin/env bash
# Start DuckDB Local UI connected to MotherDuck
# The UI runs at http://localhost:4213

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Load MOTHERDUCK_TOKEN from backend/.env if not already set
if [ -z "${MOTHERDUCK_TOKEN:-}" ]; then
  ENV_FILE="$REPO_ROOT/backend/.env"
  if [ -f "$ENV_FILE" ]; then
    MOTHERDUCK_TOKEN=$(grep -E '^MOTHERDUCK_TOKEN=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    export MOTHERDUCK_TOKEN
  fi
fi

if [ -z "${MOTHERDUCK_TOKEN:-}" ]; then
  echo "Error: MOTHERDUCK_TOKEN not set. Add it to backend/.env or export it."
  exit 1
fi

# Workaround for SSL cert verification failure when fetching UI assets
# See: https://github.com/duckdb/duckdb-ui/issues/95
export ui_disable_server_certificate_verification=1

DB_NAME="${MOTHERDUCK_DATABASE:-browserbase_demo}"

echo "Starting DuckDB UI connected to md:$DB_NAME ..."
echo "Open http://localhost:4213 or navigate to /explorer in BasedHoc"
echo ""

# start_ui() launches the web server in a background thread. DuckDB must stay
# alive for the server to keep running. We pipe a blocking read into stdin so
# it doesn't exit when there's no TTY (e.g. background mode).
# Press Ctrl-C to stop.
cleanup() { kill %1 2>/dev/null; exit 0; }
trap cleanup INT TERM

# Keep stdin open via a FIFO so DuckDB doesn't exit when there's no TTY
FIFO=$(mktemp -u)
mkfifo "$FIFO"
trap 'rm -f "$FIFO"; cleanup' INT TERM EXIT

duckdb "md:$DB_NAME?motherduck_token=$MOTHERDUCK_TOKEN" \
  -cmd "INSTALL ui; LOAD ui; CALL start_ui();" \
  -cmd "SELECT 'Explorer ready at http://localhost:4213' AS status;" \
  < "$FIFO" &

# Keep the FIFO open (writer side) so DuckDB blocks on stdin
exec 3>"$FIFO"

echo "Press Ctrl-C to stop."
wait
