#!/usr/bin/env bash
# Run the API, the public site and the admin console together.
# Ctrl-C stops all three.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$ROOT/.env" ]] || { echo "error: no .env — copy .env.example first" >&2; exit 1; }

pids=()
cleanup() { trap - INT TERM EXIT; kill "${pids[@]}" 2>/dev/null || true; }
trap cleanup INT TERM EXIT

prefix() { while IFS= read -r line; do printf '[%s] %s\n' "$1" "$line"; done; }

( cd "$ROOT/backend"  && go run ./cmd/api 2>&1 | prefix api ) &   pids+=($!)
( cd "$ROOT/frontend" && npm run dev     2>&1 | prefix web ) &    pids+=($!)
( cd "$ROOT/admin"    && npm run dev     2>&1 | prefix admin ) &  pids+=($!)

echo "api   http://localhost:${API_PORT:-8080}"
echo "web   http://localhost:3000"
echo "admin http://localhost:3001"
wait
