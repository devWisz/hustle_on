# Deployment

Three things to run: the Go API, the Next.js app, and a Postgres database.
Object storage and a transactional email provider are external.

## Before the first deploy

Generate a session secret per environment and store it in that environment's
secret manager, never in a tracked file:

```bash
bash scripts/gen-secrets.sh
```

Production refuses to start without a Resend key, without storage credentials,
or on any cluster other than `mainnet-beta`. That is deliberate: the development
conveniences are refused outright rather than degraded, so a variable somebody
forgot cannot silently weaken the deployment.

## Environment

Everything in `.env.example` applies. What changes in production:

```bash
APP_ENV=production
LOG_LEVEL=info
WEB_PUBLIC_URL=https://hustleon.com          # https is enforced
CORS_ALLOWED_ORIGINS=https://hustleon.com
TRUST_PROXY_HEADERS=true                     # only behind a proxy that sets XFF

DATABASE_URL=…pooler…?sslmode=require        # the API uses the pooled endpoint,
                                             # as a login role inheriting sardhana_app
DATABASE_URL_DIRECT=…                        # migrations use the direct one, as the owner
DATABASE_MAX_CONNS=10                        # stay inside the pooler's allowance

RESEND_API_KEY=…
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=…                             # a paid endpoint; the public one rate limits
STORAGE_ACCESS_KEY_ID=…
STORAGE_SECRET_ACCESS_KEY=…
STORAGE_PUBLIC_BASE_URL=https://media.hustleon.com
```

`TRUSTED_PROXY_HOPS` (or `TRUST_PROXY_HEADERS=true`, which means one) must stay
at zero unless something in front of the API overwrites `X-Forwarded-For`.
Honouring it otherwise lets any client claim any address and bypass every
per-address limit. Set it to the exact number of proxies you operate.

Production refuses to start without `sslmode=require` on `DATABASE_URL`: session
digests, emails and payout addresses cross that connection, and pgx would
otherwise negotiate TLS only if the server offered it.

The API should connect as a login role that inherits `sardhana_app`, not as the
database owner — the owner is for migrations. See
[database.md](database.md#the-application-role).

## Before you deploy

```bash
make preflight          # or: scripts/preflight.sh [env-file]
```

`config.Load` already refuses to start without the things that would be unsafe to
run without. The preflight checks the things that are merely *easy to get wrong*
and therefore reach production anyway:

- `SESSION_COOKIE_NAME` and `NEXT_PUBLIC_SESSION_COOKIE` agreeing. If they
  disagree the frontend reads a cookie that is not there, and every
  state-changing request fails its CSRF check with nothing to explain why.
- Origins that still point at localhost, an `EMAIL_FROM` on a local domain, an
  `sslmode` that would let the database connection fall back to plaintext.
- `SOLANA_CLUSTER` not being `mainnet-beta`, and the public RPC endpoint, which
  rate limits under load.
- A storage endpoint that is not https — which would make the API serve uploads
  off local disk in production.
- `TRUSTED_PROXY_HOPS` at zero behind a load balancer, so every visitor looks
  like the proxy and the per-address limits act on the whole site at once.
- The console reachable from anywhere, and admin sessions that never expire.
- Development-seed accounts still holding a login, migrations not applied, and a
  `DATABASE_URL` that connects as the **owner** of the tables — which makes every
  least-privilege grant inert.

It exits non-zero and names what to fix. Warnings are the settings worth a
second look rather than blockers.

## The two halves have to agree

The web app is built with `NEXT_PUBLIC_*` baked in, so **redeploy it after
changing any of them**:

| Setting | Where it must match |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The API's public https origin |
| `NEXT_PUBLIC_SITE_URL` | The web app's public https origin; must equal `WEB_PUBLIC_URL` |
| `NEXT_PUBLIC_SESSION_COOKIE` | `SESSION_COOKIE_NAME` |
| `INTERNAL_PROXY_SECRET` | The API's, at runtime — this is what lets a page render be rate limited per visitor instead of per web server |

## Build

```bash
make build     # backend/bin/api and frontend/.next
```

The `Dockerfile` at the repository root builds the API and the `migrate` tool
into a distroless image. The build context is the root, because the backend
depends on the sibling `auth` module.

## Production layout

Put the web app and the API on the same registrable domain:

| Piece | Host | Example |
| --- | --- | --- |
| Web app | Vercel (or any Node host) | `https://hustleon.com` |
| API | Render, from `render.yaml` | `https://api.hustleon.com` |
| Database | Neon | pooled URL for the API, direct URL for migrations |

The session cookie is set by the API and read by the web app's server, so both
must see it. Set `SESSION_COOKIE_DOMAIN=.hustleon.com` on the API. With the API
on a different site altogether (for example `onrender.com` next to
`vercel.app`), browsers will not share the cookie and signing in will not stick,
so give the API a custom domain before launch.

## Render

`render.yaml` is a Render blueprint for the API. Create the service from it
(New, Blueprint) and fill in the variables it marks as unset:

| Variable | Value |
| --- | --- |
| `APP_ENV` | `production` once Resend, object storage and mainnet are ready; the API refuses to start in production without them |
| `DATABASE_URL` | Neon pooled connection string |
| `WEB_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS` | `https://hustleon.com` |
| `API_PUBLIC_URL` | `https://api.hustleon.com` |
| `SESSION_COOKIE_DOMAIN` | `.hustleon.com` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend key and a verified sender |
| `STORAGE_*` | S3-compatible bucket for recordings |
| `SOLANA_CLUSTER`, `SOLANA_RPC_URL` | `mainnet-beta` and a paid RPC endpoint in production |

`INTERNAL_PROXY_SECRET` must match on the API and the web app. When the web
app renders a page it calls the API on the visitor's behalf, and without this
every visitor would share the web server's rate-limit bucket. Generate it with
`openssl rand -base64 48`.

`TRUSTED_PROXY_HOPS=1` tells the API that Render's proxy appends the client
address to `X-Forwarded-For`, and to read that entry rather than one a client
could forge. `SESSION_SECRET` is generated by Render. The API listens on the
`PORT` Render provides.

If the service was created by hand instead of from the blueprint, set its
Dockerfile path to `./Dockerfile` and its build context to `.`.

## Vercel

Set the project root to `frontend` and these variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.hustleon.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://hustleon.com` |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `mainnet-beta` in production |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | the same RPC endpoint as the API |
| `INTERNAL_PROXY_SECRET` | the same value as on the API; server-side only |

The web app sends a nonce-based Content Security Policy that only lets its own
scripts run and only lets the browser talk to the API and the RPC endpoint
above, so those two variables also shape the policy.

## Launch checklist

- Migrations applied: `DATABASE_URL_DIRECT=… make db-migrate`
- Development seed not loaded (the tool refuses when `APP_ENV=production`)
- An admin account exists: sign in once, then `UPDATE users SET role = 'admin' WHERE email = '…';`
- `/health/ready` is green on the API
- Signing in on the web app lands on the dashboard (proves the cookie domain)
- A test sponsorship on devnet confirms before switching to mainnet

## Migrations

Run them as a release step, before the new API starts:

```bash
DATABASE_URL_DIRECT=… bash scripts/migrate.sh up
```

Each migration and its bookkeeping row commit together, so a failure leaves
neither a half-applied schema nor a false record of success. An advisory lock
means two instances starting at once cannot both apply the same migration.

Write migrations so the previous version of the API still works against the new
schema — add columns before writing to them, drop them a release later. That way
a rollback of the application does not require a rollback of the database.

## Health checks

| Endpoint | Use |
| --- | --- |
| `GET /health` | Liveness. Answers as long as the process is up |
| `GET /health/ready` | Readiness. Pings the database; 503 when it is unreachable |

Point the load balancer at `/health/ready` so an instance that cannot reach
Postgres is taken out of rotation rather than serving errors.

## Shutdown

`SIGTERM` starts a graceful drain with a 20-second timeout. Give the platform at
least 30 seconds before it sends `SIGKILL`.

## After deploying

- Request a sign-in link and open it end to end.
- Upload something, approve it, confirm it appears on the feed.
- Check `/health/ready` returns 200.
- Confirm the footer says `mainnet-beta`.

## Operational notes

**Logs** are structured JSON with a request id on every line, echoed to the
client as `X-Request-Id`. A user reporting a failure can be matched to the exact
request.

**Query strings are never logged** — the sign-in callback carries a token in
one.

**The settle worker** runs inside the API process, sweeping unconfirmed
donations every two minutes. Running several API instances means several
sweepers; that is safe, because `ConfirmDonation` is idempotent on
`status = 'submitted'`.

**Backups** are Neon's point-in-time restore. Object storage is separate —
losing it loses the video for every published timelapse, so it needs its own
backup or replication policy.
