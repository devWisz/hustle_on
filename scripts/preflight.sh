#!/usr/bin/env bash
# Production readiness check.
#
# `config.Load` already refuses to start without the things that would be unsafe
# to run without — a session secret, a Resend key, storage credentials, mainnet.
# This checks the things that are merely *easy to get wrong*, which are the ones
# that reach production anyway: a cookie name that disagrees between the two
# halves of the app, an origin still pointing at localhost, a public RPC endpoint
# that rate limits its own users, an account from the development seed still
# holding the admin role.
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
echo "Sardhana production preflight"
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
api_cookie="${SESSION_COOKIE_NAME:-sardhana_session}"
web_cookie="${NEXT_PUBLIC_SESSION_COOKIE:-sardhana_session}"
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

echo "email"
requires RESEND_API_KEY
requires EMAIL_FROM
if [[ -n "${EMAIL_FROM:-}" && "${EMAIL_FROM}" == *localhost* ]]; then
  fail "EMAIL_FROM still points at localhost; every sign-in link will bounce"
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
if [[ -n "${ADMIN_SESSION_MAX_AGE_HOURS:-}" ]]; then pass "ADMIN_SESSION_MAX_AGE_HOURS=${ADMIN_SESSION_MAX_AGE_HOURS}"; else warn "ADMIN_SESSION_MAX_AGE_HOURS is unset: admin sessions never expire"; fi
echo

# Live checks. These are skipped rather than failed when the database cannot be
# reached from wherever this runs: a missing psql is not a production defect.
if command -v psql >/dev/null 2>&1 && [[ -n "$dsn" ]]; then
  echo "database contents"
  query() { psql "$dsn" -At -c "$1" 2>/dev/null || echo ""; }

  applied="$(query "select count(*) from schema_migrations")"
  if [[ -n "$applied" ]]; then
    pass "$applied migrations recorded as applied"
    pending_dir="$ROOT/database/migrations"
    total=$(find "$pending_dir" -name '*.up.sql' | wc -l | tr -d ' ')
    if [[ "$applied" != "$total" ]]; then
      fail "there are $total migration files but $applied applied — run make db-migrate"
    fi
  else
    warn "could not read schema_migrations; skipping the migration and account checks"
  fi

  demo="$(query "select count(*) from users where email::text like '%@sardhana.test'")"
  if [[ "$demo" =~ ^[0-9]+$ ]]; then
    if (( demo == 0 )); then
      pass "no development-seed accounts remain"
    else
      fail "$demo development-seed account(s) still exist — see database/README.md for how to replace them"
    fi
  fi

  admins="$(query "select count(*) from users where role = 'admin'")"
  if [[ "$admins" =~ ^[0-9]+$ ]] && (( admins >= 1 )); then
    pass "$admins admin account(s)"
  elif [[ -n "$admins" ]]; then
    fail "no admin account exists: nobody can review submissions"
  fi

  if [[ "${ALLOW_OWNER_ROLE:-}" != "true" ]]; then
    owner="$(query "select count(*) from pg_roles where rolname='sardhana_app'")"
    if [[ "$owner" == "1" ]]; then
      app_role="$(query "select count(*) from pg_roles r where r.rolname = session_user and pg_has_role(session_user, 'sardhana_app', 'member')")"
      if [[ "$app_role" == "1" ]]; then
        pass "the API's database role inherits sardhana_app"
      else
        warn "the session role does not inherit sardhana_app; the API would run with owner privileges (set ALLOW_OWNER_ROLE=true to accept)"
      fi
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
