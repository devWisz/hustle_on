#!/usr/bin/env bash
# Creates (or rotates) the database login role the API connects as.
#
# Migration 0008 gives the `sardhana_app` group exactly the privileges the API
# uses — read and write the tables, and nothing else. What it deliberately does
# not do is create a *login*, because a password does not belong in a migration:
# a migration is committed, replayed on every environment, and read by anyone
# with the repository.
#
# This script is that missing half. It creates a login role in that group, gives
# it the session guards, and can point .env at it.
#
# Usage:
#   scripts/create-api-role.sh                    # create or rotate, print the DSN shape
#   scripts/create-api-role.sh --write-env        # ...and set DATABASE_URL to it
#   scripts/create-api-role.sh --name other_api    # a different role name
#
# It needs DATABASE_URL_DIRECT (the owner): creating a role is DDL. The running
# API can keep using the old credentials until --write-env is passed, and
# whoever runs it needs to restart the API afterwards.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
ROLE="hustleon_api"
GROUP="sardhana_app"
WRITE_ENV=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) ROLE="${2:?--name needs a value}"; shift 2 ;;
    --write-env) WRITE_ENV=true; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

OWNER_DSN="${DATABASE_URL_DIRECT:-}"
if [[ -z "$OWNER_DSN" ]]; then
  echo "DATABASE_URL_DIRECT is not set: creating a role needs the owner connection." >&2
  exit 1
fi

password="$(openssl rand -hex 32)"

# The role, the group, and the guards.
#
# The guards are set on the login role itself as well as on the group, because a
# role setting applies to a session started *as* that role: a member does not
# inherit the group's settings unless it activates the group with SET ROLE. A
# login that relied on the group's copy would run with no statement timeout at
# all, which is the opposite of what it looks like.
psql "$OWNER_DSN" -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$ROLE') THEN
        CREATE ROLE $ROLE LOGIN IN ROLE $GROUP;
    END IF;
END
\$\$;

ALTER ROLE $ROLE WITH LOGIN PASSWORD '$password';
-- IN ROLE is only valid on CREATE ROLE; membership on an existing role is a
-- separate grant.
GRANT $GROUP TO $ROLE;
ALTER ROLE $ROLE SET statement_timeout = '10s';
ALTER ROLE $ROLE SET lock_timeout = '5s';
ALTER ROLE $ROLE SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE $ROLE SET search_path = public, pg_catalog;
ALTER ROLE $ROLE CONNECTION LIMIT 20;

COMMENT ON ROLE $ROLE IS 'Sardhana API login. Inherits $GROUP; holds no privileges of its own.';

-- Prove the boundary before reporting success: a role that can delete an
-- account, or edit the audit trail, is the failure this script exists to avoid.
SELECT
    'can read data:      ' || has_table_privilege('$ROLE', 'timelapses', 'SELECT')::text,
    'can write data:     ' || has_table_privilege('$ROLE', 'timelapses', 'INSERT')::text,
    'can delete accounts:' || has_table_privilege('$ROLE', 'users', 'DELETE')::text,
    'can edit audit:     ' || has_table_privilege('$ROLE', 'audit_log', 'UPDATE')::text,
    'can read migrations:' || has_table_privilege('$ROLE', 'schema_migrations', 'SELECT')::text;
SQL

# The DSN keeps the host and database of the connection we were given, and swaps
# only the credentials.
host_and_rest="${OWNER_DSN#*://}"
rest="${host_and_rest#*@}"
new_dsn="postgresql://$ROLE:$password@$rest"

if $WRITE_ENV; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "no $ENV_FILE to write to; here is the DSN for whoever deploys:" >&2
    echo "$new_dsn"
    exit 0
  fi
  # Only DATABASE_URL is replaced. DATABASE_URL_DIRECT stays as the owner,
  # because migrations need DDL.
  python3 - "$ENV_FILE" "$new_dsn" <<'PY'
import re, sys
path, dsn = sys.argv[1], sys.argv[2]
text = open(path).read()
updated, count = re.subn(r"^DATABASE_URL=.*$", "DATABASE_URL=" + dsn, text, count=1, flags=re.M)
if count == 0:
    raise SystemExit("no DATABASE_URL line found in " + path)
open(path, "w").write(updated)
PY
  echo
  echo "DATABASE_URL now points at $ROLE. Restart the API to use it."
else
  echo
  echo "Role ready. Add this to the environment the API runs in:"
  echo "  DATABASE_URL=$new_dsn"
fi
