#!/usr/bin/env bash
# Production readiness check.
#
# `config.Load` already refuses to start without the things that would be unsafe
# to run without — a session secret, operator wallets, storage credentials,
# mainnet. This checks the things that are merely *easy to get wrong*, which are
# the ones that reach production anyway: a cookie name that disagrees between the
# two halves of the app, an origin still pointing at localhost, a public RPC
# endpoint that rate limits its own users, an account that can no longer sign in.
#
# Usage:  scripts/preflight.sh [env-file]      (default: .env)
# Exit:   0 ready, 1 something must be fixed.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

failures=0
warnings=0

red=$'\033[31m'; yellow=$'\033[33m'; green=$'\033[32m'; dim=$'\033[2m'; reset=$'\033[0m'

fail() { printf '%s  FAIL%s %s\n' "$red" "$reset" "$1"; failures=$((failures + 1)); }
warn() { printf '%s  WARN%s %s\n' "$yellow" "$reset" "$1"; warnings=$((warnings + 1)); }
pass() { printf '%s  ok%s   %s\n' "$green" "$reset" "$1"; }

# requires NAME [expected]
requires() {
  local name="$1" value="${!1:-}"
  if [[ -z "$value" ]]; then fail "$name is not set"; else pass "$name is set"; fi
}

# is_https URL
is_https() { [[ "${1:-}" == https://* ]]; }

echo
echo "Hustle On production preflight"
echo "${dim}env file: $ENV_FILE${reset}"
echo

echo "environment"
if [[ "${APP_ENV:-}" == "production" ]]; then
  pass "APP_ENV=production"
else
  fail "APP_ENV must be production (got '${APP_ENV:-unset}') — development relaxations apply otherwise"
fi
if [[ -n "${LOG_LEVEL:-}" ]]; then pass "LOG_LEVEL=${LOG_LEVEL}"; else warn "LOG_LEVEL is unset (defaults to info)"; fi
echo

echo "web origin and cookies"
is_https "${WEB_PUBLIC_URL:-}" && pass "WEB_PUBLIC_URL is https" \
  || fail "WEB_PUBLIC_URL must be https (got '${WEB_PUBLIC_URL:-unset}')"
is_https "${NEXT_PUBLIC_SITE_URL:-}" && pass "NEXT_PUBLIC_SITE_URL is https" \
  || fail "NEXT_PUBLIC_SITE_URL must be https (got '${NEXT_PUBLIC_SITE_URL:-unset}')"

# The two halves of the app have to agree about the cookie name. If they do not,
# the frontend reads a cookie that is not there and every state-changing request
# fails its CSRF check with no clue as to why.
api_cookie="${SESSION_COOKIE_NAME:-hustleon_session}"
web_cookie="${NEXT_PUBLIC_SESSION_COOKIE:-hustleon_session}"
if [[ "$api_cookie" == "$web_cookie" ]]; then
  pass "session cookie name matches on both sides ($api_cookie)"
else
  fail "SESSION_COOKIE_NAME ($api_cookie) and NEXT_PUBLIC_SESSION_COOKIE ($web_cookie) must match"
fi

if [[ -n "${SESSION_COOKIE_DOMAIN:-}" ]]; then
  pass "SESSION_COOKIE_DOMAIN=${SESSION_COOKIE_DOMAIN}"
else
  warn "SESSION_COOKIE_DOMAIN is unset: the session will be host-only, so the API and the web app must share a host"
fi
for var in WEB_PUBLIC_URL NEXT_PUBLIC_SITE_URL CORS_ALLOWED_ORIGINS; do
  if [[ "${!var:-}" == *localhost* || "${!var:-}" == *127.0.0.1* ]]; then
    fail "$var still points at localhost"
  fi
done
echo

echo "secrets"
if [[ "${#SESSION_SECRET}" -ge 32 ]]; then pass "SESSION_SECRET is ${#SESSION_SECRET} bytes"
else fail "SESSION_SECRET must be at least 32 bytes"; fi
if [[ -n "${INTERNAL_PROXY_SECRET:-}" && "${#INTERNAL_PROXY_SECRET}" -ge 32 ]]; then
  pass "INTERNAL_PROXY_SECRET is ${#INTERNAL_PROXY_SECRET} bytes"
else
  fail "INTERNAL_PROXY_SECRET must be at least 32 bytes — without it page renders are not attributed to the visitor"
fi
echo

echo "database"
dsn="${DATABASE_URL:-}"
if [[ -z "$dsn" ]]; then
  fail "DATABASE_URL is not set"
else
  mode="$(printf '%s' "$dsn" | tr 'A-Z' 'a-z' | sed -n 's/.*sslmode=\([a-z-]*\).*/\1/p')"
  case "$mode" in
    require|verify-ca|verify-full) pass "DATABASE_URL sets sslmode=$mode" ;;
    "") fail "DATABASE_URL has no sslmode; production requires sslmode=require" ;;
    *) fail "DATABASE_URL sets sslmode=$mode; production requires require or stricter" ;;
  esac
  if printf '%s' "$dsn" | grep -qi 'localhost\|127.0.0.1'; then
    fail "DATABASE_URL points at localhost"
  fi
  if printf '%s' "$dsn" | grep -q 'neondb_owner'; then
    warn "DATABASE_URL uses the database owner; the API should use a login role that inherits sardhana_app"
  fi
  conns="${DATABASE_MAX_CONNS:-10}"
  if [[ "$conns" =~ ^[0-9]+$ ]] && (( conns >= 1 && conns <= 100 )); then
    pass "DATABASE_MAX_CONNS=$conns"
  else
    fail "DATABASE_MAX_CONNS must be between 1 and 100 (got '$conns')"
  fi
fi
if [[ -n "${DATABASE_URL_DIRECT:-}" ]]; then pass "DATABASE_URL_DIRECT is set (migrations)"; else warn "DATABASE_URL_DIRECT is unset; migrations will fall back to the pooled endpoint and may fail"; fi
echo

echo "operator access"
# Admin access is a property of this environment, not of a database row, so an
# unset list is not a security hole — it is an unreachable console. That is the
# failure being looked for here: a deployment where nobody can review anything.
if [[ -n "${ADMIN_WALLETS:-}" ]]; then
  bad=""
  for addr in ${ADMIN_WALLETS//,/ }; do
    # A Solana address is base58 and decodes to 32 bytes; 32-44 characters is the
    # only shape that can be checked without decoding here. A typo that survives
    # this is caught at boot by config.Load, which names the offending value.
    if (( ${#addr} < 32 || ${#addr} > 44 )); then bad="$bad $addr"; fi
  done
  if [[ -n "$bad" ]]; then
    fail "ADMIN_WALLETS contains something that is not a Solana address:$bad"
  else
    pass "ADMIN_WALLETS is set"
  fi
else
  fail "ADMIN_WALLETS is empty; nobody can reach the admin console"
fi
echo

echo "sponsorship program"
if [[ -n "${HUSTLEON_PAY_PROGRAM_ID:-}" ]]; then
  pass "HUSTLEON_PAY_PROGRAM_ID is set; sponsorships are verified against the program"
else
  warn "HUSTLEON_PAY_PROGRAM_ID is unset; sponsorships fall back to verifying a plain SOL transfer, which carries no on-chain record"
fi
echo

echo "object storage"
requires STORAGE_BUCKET
requires STORAGE_ACCESS_KEY_ID
requires STORAGE_SECRET_ACCESS_KEY
requires STORAGE_ENDPOINT
if is_https "${STORAGE_ENDPOINT:-}"; then pass "STORAGE_ENDPOINT is https"; else fail "STORAGE_ENDPOINT must be https"; fi
if [[ "${STORAGE_ENDPOINT:-}" == *localhost* || "${STORAGE_ENDPOINT:-}" == *127.0.0.1* ]]; then
  fail "STORAGE_ENDPOINT points at localhost: the API would serve uploads off local disk in production"
fi
if is_https "${STORAGE_PUBLIC_BASE_URL:-}"; then
  pass "STORAGE_PUBLIC_BASE_URL is https"
else
  warn "STORAGE_PUBLIC_BASE_URL is unset: playable links will be signed on every request instead of served from a CDN"
fi
echo

echo "solana"
if [[ "${SOLANA_CLUSTER:-}" == "mainnet-beta" ]]; then
  pass "SOLANA_CLUSTER=mainnet-beta"
else
  fail "SOLANA_CLUSTER must be mainnet-beta (got '${SOLANA_CLUSTER:-unset}'); donors would be sending real SOL to a test network"
fi
if [[ "${SOLANA_RPC_URL:-}" == "https://api.mainnet-beta.solana.com" ]]; then
  warn "SOLANA_RPC_URL is the public endpoint, which rate limits under load; use a paid provider for donation verification"
elif is_https "${SOLANA_RPC_URL:-}"; then
  pass "SOLANA_RPC_URL is https"
else
  fail "SOLANA_RPC_URL must be https"
fi
echo

echo "rate limits"
for var in RATE_LIMIT_ANON RATE_LIMIT_AUTH_ATTEMPTS RATE_LIMIT_IP_CEILING RATE_LIMIT_ENGAGE \
           RATE_LIMIT_WRITE RATE_LIMIT_UPLOAD RATE_LIMIT_POSTER RATE_LIMIT_DONATE RATE_LIMIT_ADMIN; do
  value="${!var:-}"
  if [[ -z "$value" ]]; then
    pass "$var unset (uses the built-in default)"
  elif [[ "$value" =~ ^[0-9]+$ ]] && (( value >= 1 )); then
    pass "$var=$value"
  else
    fail "$var must be a positive integer (got '$value')"
  fi
done
echo

echo "proxy and console"
hops="${TRUSTED_PROXY_HOPS:-0}"
if [[ "${TRUST_PROXY_HEADERS:-false}" == "true" ]]; then
  warn "TRUST_PROXY_HEADERS is set; TRUSTED_PROXY_HOPS=$hops supersedes it"
fi
if [[ "$hops" =~ ^[0-9]+$ ]] && (( hops >= 1 )); then
  pass "TRUSTED_PROXY_HOPS=$hops (visitor addresses come from the proxy)"
else
  warn "TRUSTED_PROXY_HOPS=0: every visitor will be seen as the proxy's address, so rate limits act on the web server as a whole"
fi
if [[ -n "${ADMIN_ALLOWED_IPS:-}" ]]; then pass "ADMIN_ALLOWED_IPS restricts the console"; else warn "ADMIN_ALLOWED_IPS is unset: the console is reachable from anywhere for a signed-in admin"; fi
admin_age="${ADMIN_SESSION_MAX_AGE_HOURS:-12}"
if [[ "$admin_age" =~ ^[0-9]+$ ]] && (( admin_age >= 1 )); then
  pass "admin sessions are re-authenticated after ${admin_age}h"
else
  fail "ADMIN_SESSION_MAX_AGE_HOURS=${admin_age} lets an admin session live forever"
fi
if [[ "${SOLANA_ALLOW_TEST_CLUSTER:-}" == "true" ]]; then
  fail "SOLANA_ALLOW_TEST_CLUSTER=true relaxes the mainnet requirement; it is for a beta, not for production"
else
  pass "no test-cluster escape hatch is enabled"
fi
echo

# Live checks. These are skipped rather than failed when the database cannot be
# reached from wherever this runs: a missing psql is not a production defect.
if command -v psql >/dev/null 2>&1 && [[ -n "$dsn" ]]; then
  echo "database contents"
  query() { psql "$dsn" -At -c "$1" 2>/dev/null || echo ""; }
  # The ledger is deliberately unreadable by the API's own role, so anything
  # about migrations has to be asked over the owner connection.
  owner_query() { psql "${DATABASE_URL_DIRECT:-$dsn}" -At -c "$1" 2>/dev/null || echo ""; }

  applied="$(owner_query "select count(*) from schema_migrations")"
  pending_dir="$ROOT/database/migrations"
  total=$(find "$pending_dir" -name '*.up.sql' | wc -l | tr -d ' ')
  if [[ "$applied" =~ ^[0-9]+$ ]]; then
    if [[ "$applied" == "$total" ]]; then
      pass "all $total migrations are applied"
    else
      fail "there are $total migration files but $applied applied — run make db-migrate"
    fi
  else
    warn "could not read schema_migrations over the owner connection; expected $total applied"
  fi

  # An account with no wallet_address cannot sign in. That is not a hypothetical:
  # it is every account that existed before migration 0013, because email used to
  # be the identity and nobody had linked a wallet yet. Left alone, those
  # accounts are simply gone as far as their owners are concerned.
  stranded="$(query "select count(*) from users where wallet_address is null")"
  if [[ "$stranded" =~ ^[0-9]+$ ]]; then
    if (( stranded == 0 )); then
      pass "every account has a wallet address and can sign in"
    else
      fail "$stranded account(s) have no wallet address and cannot sign in — each needs a wallet linked, or should be removed"
    fi
  fi

  admins="$(query "select count(*) from users where role = 'admin'")"
  if [[ "$admins" =~ ^[0-9]+$ ]] && (( admins >= 1 )); then
    pass "$admins admin account(s)"
  elif [[ -n "$admins" ]]; then
    fail "no admin account exists: nobody can review submissions"
  fi

  # The privileged operations the API must not be able to perform. These are
  # asked of the *connection*, not of the configuration: a role name in an
  # environment variable proves nothing about what it can do.
  probe() { query "select $1"; }
  if [[ "$(probe "has_table_privilege(session_user, 'users', 'DELETE')")" == "t" ]]; then
    fail "the API's database role can DELETE an account — migration 0008's revoke is not in effect"
  else
    pass "the API's role cannot delete accounts"
  fi
  if [[ "$(probe "has_table_privilege(session_user, 'audit_log', 'UPDATE')")" == "t" ]]; then
    fail "the API's database role can edit the audit trail"
  else
    pass "the API's role cannot edit the audit trail"
  fi
  if [[ "$(probe "has_table_privilege(session_user, 'schema_migrations', 'SELECT')")" == "t" ]]; then
    fail "the API's database role can read the migration ledger"
  else
    pass "the API's role cannot read the migration ledger"
  fi

  trigger="$(query "select tgname from pg_trigger where tgname = 'audit_log_append_only' and tgenabled <> 'D'")"
  if [[ "$trigger" == "audit_log_append_only" ]]; then
    pass "the append-only trigger is armed on audit_log"
  else
    fail "the append-only trigger is missing or disabled on audit_log"
  fi

  # A role setting applies to a session started as that role, so a login that
  # inherits a group does not inherit the group's timeouts. Asking the live
  # connection is the only way to know the guards are actually on.
  timeout_setting="$(query "show statement_timeout")"
  if [[ -n "$timeout_setting" && "$timeout_setting" != "0" ]]; then
    pass "the API's connection has a statement_timeout of $timeout_setting"
  else
    fail "the API's connection has no statement_timeout: one bad query can hold a connection open indefinitely"
  fi

  if [[ "${ALLOW_OWNER_ROLE:-}" != "true" ]]; then
    # Ownership of a table, not membership of a role: delegating CREATEROLE means
    # the creator is automatically a member of any role it creates, so a
    # membership test says "fine" about exactly the connection this is looking
    # for. Owning the table is what makes every REVOKE in migration 0008 inert.
    owns="$(query "select count(*) from pg_tables where tablename = 'timelapses' and tableowner = session_user")"
    if [[ "$owns" == "1" ]]; then
      fail "DATABASE_URL connects as the owner of the tables: the least-privilege grants are inert (set ALLOW_OWNER_ROLE=true only if that is deliberate)"
    elif [[ -n "$owns" ]]; then
      pass "the API's database role does not own the tables"
    fi
  fi
  echo
fi

if (( failures == 0 )); then
  printf '%sReady.%s %s warning(s).\n\n' "$green" "$reset" "$warnings"
  exit 0
fi
printf '%sNot ready:%s %s problem(s), %s warning(s).\n\n' "$red" "$reset" "$failures" "$warnings"
exit 1
