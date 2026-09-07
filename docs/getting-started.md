# Getting started

## Prerequisites

| Tool | Version | Needed for |
| ---- | ------- | ---------- |
| Go | 1.23+ | backend and auth module |
| Node | 20+ | frontend and admin |
| psql | 15+ | migrations |
| Rust + Anchor | 0.30.1 | the Solana program (optional for web work) |

A Neon account, a Resend account and a Solana devnet wallet complete the set.
None of them cost anything at the volumes local development produces.

## 1. Configure

```bash
cp .env.example .env
bash scripts/gen-secrets.sh        # paste SESSION_SECRET into .env
```

Fill in from Neon: `DATABASE_URL` (the **pooled** string, with `-pooler` in the
host) and `DATABASE_URL_DIRECT` (the unpooled one). Migrations need the direct
endpoint; the API needs the pooled one.

`RESEND_API_KEY` can stay empty locally. Without it, sign-in links are printed
to the API log instead of emailed, which is faster to work with. The API
refuses to start in production without a key, so this shortcut cannot ship.

## 2. Create the schema

```bash
make db-migrate
make db-seed          # three accounts, two sessions, one role
```

## 3. Run everything

```bash
make setup            # once
make dev
```

- API — http://localhost:8080
- Web — http://localhost:3000
- Admin — http://localhost:3001

## 4. Sign in

Open http://localhost:3000/login, enter any address, and look in the API log
for a block like:

```
--- email to you@example.com ---
Sign in to Sardhana
http://localhost:3000/auth/verify?token=...
```

Open that URL. The account is created on first verification.

To reach the admin console, promote yourself:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

Then sign out and back in — the role is read from the database on every
request, but the session cookie must exist for the console to use it.

## 5. Work on the program (optional)

```bash
cd contracts
anchor build
anchor test           # spins up a local validator
```

## Common problems

**`configuration invalid: SESSION_SECRET must be at least 32 bytes`** — run
`scripts/gen-secrets.sh` and paste the value into `.env`.

**Migrations hang or fail on `CREATE TYPE`** — you are pointed at the pooled
endpoint. Set `DATABASE_URL_DIRECT` to the unpooled one.

**The first request after a break is slow** — a Neon compute that scaled to
zero is starting. It happens once.

**`This request could not be verified`** — the browser origin is not in
`CORS_ALLOWED_ORIGINS`. Add it and restart the API.
