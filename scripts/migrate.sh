#!/usr/bin/env bash
# Plain-SQL migration runner for Neon Postgres.
# Usage: scripts/migrate.sh [up|down|status|seed]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/database/migrations"
# `set -e` is active, so this cannot be a && chain: a missing .env would make
# the whole line return non-zero and abort the script.
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# Migrations need the direct (unpooled) endpoint: they use advisory locks and
# DDL that the connection pooler does not carry across statements.
DSN="${DATABASE_URL_DIRECT:-${DATABASE_URL:-}}"
if [[ -z "$DSN" ]]; then
  echo "error: set DATABASE_URL_DIRECT or DATABASE_URL" >&2
  exit 1
fi
if ! command -v psql >/dev/null; then
  exec bash -c "cd '$ROOT/backend' && go run ./cmd/migrate '${1:-up}'"
fi

psql_do() { psql "$DSN" -v ON_ERROR_STOP=1 -q "$@"; }

ensure_table() {
  psql_do -c "CREATE TABLE IF NOT EXISTS schema_migrations (
                version text PRIMARY KEY,
                applied_at timestamptz NOT NULL DEFAULT now()
              );"
}

applied() { psql "$DSN" -tAc "SELECT version FROM schema_migrations ORDER BY version;"; }

cmd_up() {
  ensure_table
  local ran=0
  for file in "$MIGRATIONS"/*.up.sql; do
    local version; version="$(basename "$file" .up.sql)"
    if psql "$DSN" -tAc "SELECT 1 FROM schema_migrations WHERE version='$version';" | grep -q 1; then
      continue
    fi
    echo "applying $version"
    # Each migration and its bookkeeping commit together, so a failure leaves
    # neither a half-applied schema nor a false record of success.
    psql "$DSN" -v ON_ERROR_STOP=1 -q --single-transaction \
      -c "SELECT pg_advisory_xact_lock(8123456789);" \
      -f "$file" \
      -c "INSERT INTO schema_migrations (version) VALUES ('$version');"
    ran=$((ran + 1))
  done
  [[ $ran -eq 0 ]] && echo "already up to date" || echo "applied $ran migration(s)"
}

cmd_down() {
  ensure_table
  local version; version="$(psql "$DSN" -tAc "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;" | tr -d '[:space:]')"
  [[ -z "$version" ]] && { echo "nothing to roll back"; return; }
  local file="$MIGRATIONS/$version.down.sql"
  [[ -f "$file" ]] || { echo "error: missing $file" >&2; exit 1; }
  echo "reverting $version"
  psql "$DSN" -v ON_ERROR_STOP=1 -q --single-transaction \
    -f "$file" \
    -c "DELETE FROM schema_migrations WHERE version='$version';"
}

cmd_status() {
  ensure_table
  echo "applied:"; applied | sed 's/^/  /'
  echo "pending:"
  for file in "$MIGRATIONS"/*.up.sql; do
    local version; version="$(basename "$file" .up.sql)"
    psql "$DSN" -tAc "SELECT 1 FROM schema_migrations WHERE version='$version';" | grep -q 1 || echo "  $version"
  done
}

cmd_seed() {
  if [[ "${APP_ENV:-development}" == "production" ]]; then
    echo "refusing to seed a production database" >&2
    exit 1
  fi
  psql_do -f "$ROOT/database/seeds/dev_seed.sql"
  echo "seed data loaded"
}

case "${1:-up}" in
  up) cmd_up ;;
  down) cmd_down ;;
  status) cmd_status ;;
  seed) cmd_seed ;;
  *) echo "usage: $0 [up|down|status|seed]" >&2; exit 1 ;;
esac
