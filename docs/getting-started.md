# Getting started

## What you need

- Go 1.23+
- Node 20+
- A Postgres 16 database. [Neon](https://neon.tech) is what this is built
  against; anything Postgres 16 works, including a local container.

You do **not** need object storage credentials, a Resend key, or any SOL to run
the platform locally. Each has a development path, described below.

## Setup

```bash
cp .env.example .env      # fill in DATABASE_URL and SESSION_SECRET
make setup                # go mod download, npm install
make db-migrate           # apply migrations
make db-seed              # optional: empties the tables and creates one admin
make dev                  # api :8085, web :3000
```

Generate the session secret with:

```bash
bash scripts/gen-secrets.sh
```

Anything shorter than 32 bytes is refused at startup — it is the key that signs
CSRF tokens, and a short one makes them forgeable.

### A local database, if you want one

```bash
docker run -d --name sardhana-db \
  -e POSTGRES_PASSWORD=sardhana -e POSTGRES_DB=sardhana \
  -p 5432:5432 postgres:16-alpine

# in .env
DATABASE_URL=postgres://postgres:sardhana@localhost:5432/sardhana?sslmode=disable
```

## What the development conveniences do

**Email.** With `RESEND_API_KEY` empty, sign-in links are printed to the API log
instead of being sent. Request one, then copy the URL out of the terminal:

```
Open this link to sign in:
http://localhost:3000/auth/verify?token=E7SUtVMP9Av7FDojMxBOJHhznnEb5ad8gcPSeBJ-ZsE
```

**Object storage.** With no `STORAGE_ACCESS_KEY_ID`, uploads are written to
`backend/data/uploads` and served back from the API. The upload flow works end
to end without a bucket. Those routes are registered *only* in this mode.

**Solana.** `SOLANA_CLUSTER=devnet` by default. Donations need a browser wallet
with devnet SOL; everything up to the signature works without one.

None of these are available in production. `config.Load` refuses to start
without a Resend key, without storage credentials, or on any cluster other than
`mainnet-beta` when `APP_ENV=production` — a missing variable fails loudly
rather than silently weakening the deployment.

## Making yourself an admin

Roles are granted in the database, on purpose. There is no endpoint that
promotes an account, so a bug in one cannot create an admin.

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Then `/admin` shows the review queue. Until an admin approves something, the
feed stays empty — that is the product working, not a bug.

The seed creates one account: an admin, `reviewer@sardhana.test`. It deliberately
creates no content, because the only sessions this site shows are ones a person
recorded and a reviewer approved, and a seeded imitation of that is precisely what
the review step exists to prevent.

So the honest first run is: sign in as that admin (the link prints to the API log),
upload something real from `/upload`, and approve it from `/admin/queue`. Every
screen has a considered empty state until you do — including the console, which
says what will appear rather than showing a placeholder. To use your own address,
sign in with it once and then run the one-line `UPDATE` in
[database/README.md](../database/README.md).

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
`X-Sardhana-CSRF` header. Check `CORS_ALLOWED_ORIGINS` includes
`http://localhost:3000`.
