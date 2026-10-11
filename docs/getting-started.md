# Getting started

## What you need

- Go 1.23+
- Node 20+
- A Postgres 16 database. [Neon](https://neon.tech) is what this is built
  against; anything Postgres 16 works, including a local container.

You do **not** need object storage credentials, a deployed sponsorship program,
or any SOL to run the platform locally. Each has a development path, described
below.

## Setup

```bash
cp .env.example .env      # fill in DATABASE_URL, SESSION_SECRET and ADMIN_WALLETS
make setup                # go mod download, npm install
make db-migrate           # apply migrations
make db-seed              # optional: empties every table and creates nothing
make dev                  # api :8085, web :3001
```

Generate the session secret with:

```bash
bash scripts/gen-secrets.sh
```

Anything shorter than 32 bytes is refused at startup — it is the key that signs
CSRF tokens, and a short one makes them forgeable.

### A local database, if you want one

```bash
docker run -d --name hustleon-db \
  -e POSTGRES_PASSWORD=sardhana -e POSTGRES_DB=sardhana \
  -p 5432:5432 postgres:16-alpine

# in .env
DATABASE_URL=postgres://postgres:sardhana@localhost:5432/sardhana?sslmode=disable
```

## What the development conveniences do

**Sign-in.** There is nothing to deliver. The API returns the exact text to sign
from `POST /v1/auth/signin/challenge`, the browser asks a Solana wallet to sign
it, and `POST /v1/auth/signin/verify` starts the session. Signing a message is
free and works on any cluster, so a wallet extension is the whole prerequisite.
The first sign-in creates the account.

**Object storage.** With no `STORAGE_ACCESS_KEY_ID`, uploads are written to
`backend/data/uploads` and served back from the API. The upload flow works end
to end without a bucket. Those routes are registered *only* in this mode.

**Solana.** `SOLANA_CLUSTER=devnet` by default. Sponsorships need a browser
wallet with devnet SOL; everything up to the signature works without one. Leave
`HUSTLEON_PAY_PROGRAM_ID` empty and the API verifies a plain SOL transfer, or
point it at a deployed program — see [contracts/README.md](../contracts/README.md).

None of these are available in production. `config.Load` refuses to start
without at least one `ADMIN_WALLETS` address, without storage credentials, or on
any cluster other than `mainnet-beta` when `APP_ENV=production` — a missing
variable fails loudly rather than silently weakening the deployment.

## Making yourself an admin

Admin access is a property of the environment, not of a database row. Put your
Solana address in `ADMIN_WALLETS`, restart the API, and sign in with that wallet:
it is promoted to `role = 'admin'` on that first sign-in, and the promotion is
written to the audit log. There is no endpoint that promotes an account, so a
bug in one cannot create an admin, and every address in the list is validated at
boot.

```bash
# in .env, comma-separated, no spaces
ADMIN_WALLETS=<your-wallet-address>
```

Then `/admin` shows the review queue. Until an admin approves something, the
feed stays empty — that is the product working, not a bug.

The seed creates nothing at all, and that is deliberate. It used to create an
admin at `reviewer@hustleon.test`, which is now meaningless: sign-in is a wallet
signature, so a seeded account with no key is one nobody can use. It also creates
no content, because the only sessions this site shows are ones a person recorded
and a reviewer approved, and a seeded imitation of that is precisely what the
review step exists to prevent.

So the honest first run is: sign in with your wallet, upload something real from
`/upload`, and approve it from `/admin/queue`. Every screen has a considered
empty state until you do — including the console, which says what will appear
rather than showing a placeholder.

## Everyday commands

```bash
make dev          # api and web together
make test         # go test ./... in both modules, plus tsc
make lint         # go vet, next lint
make fmt          # gofmt, prettier
make db-status    # applied and pending migrations
make db-rollback  # revert the most recent migration
```

## Common problems

**`SESSION_SECRET must be at least 32 bytes`** — run `scripts/gen-secrets.sh`.

**Migrations hang or fail on DDL** — use `DATABASE_URL_DIRECT`, the unpooled
endpoint. Migrations take advisory locks and run DDL, neither of which survives
a connection pooler.

**Signed in, but the header still says "Sign in"** — the frontend reads
`NEXT_PUBLIC_SESSION_COOKIE`, which must match `SESSION_COOKIE_NAME`.

**403 on every write** — the API needs both an allowlisted `Origin` and the
`X-Hustleon-CSRF` header. Check `CORS_ALLOWED_ORIGINS` includes
`http://localhost:3001`.
