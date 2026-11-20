#!/usr/bin/env bash
# Start the published package on Kestrel (outside Lambda the same binary runs
# as a normal web server) and check it migrates, seeds and serves data.
#
# Usage: api/scripts/smoke-test.sh [package-dir]   (default api/artifacts/lambda)
set -euo pipefail

DIR="${1:-$(cd "$(dirname "$0")/.." && pwd)/artifacts/lambda}"
PORT=8080
DB="$(mktemp -d)/smoke.db"

cd "$DIR"
ASPNETCORE_URLS="http://127.0.0.1:$PORT" \
ConnectionStrings__Finance="Data Source=$DB" \
Database__MigrateOnStartup=true \
Database__SeedDemoData=true \
  ./bootstrap &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf "http://127.0.0.1:$PORT/health" >/dev/null && break
  sleep 0.5
done

curl -sf "http://127.0.0.1:$PORT/health" | grep -q Healthy
curl -sf "http://127.0.0.1:$PORT/api/transactions?pageSize=1" | grep -q '"totalCount"'
curl -sf "http://127.0.0.1:$PORT/api/budgets" | grep -q '"lines"'
echo "Smoke test passed."
