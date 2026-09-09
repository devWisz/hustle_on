# Sardhana

**Timelapses of real work, funded by the people who want to see more of it.**

A creator records a work session, writes down what they actually did, and points
at where the result lives on GitHub or X. A person reads it before it goes
anywhere. If it holds up, it appears on the feed — and anyone who thinks the
work was worth doing can send SOL straight to the creator's wallet.

That is the whole product.

## The path

```
  record ──▶ write up ──▶ submit ──▶ [ a person reviews it ] ──▶ published
                                            │                        │
                                            └──▶ declined,           ▼
                                                 with a reason   viewers donate
                                                                 in SOL, direct
```

Three properties hold it together:

- **Nothing publishes itself.** `published` is written by exactly one statement
  in the codebase, behind the admin role, and every decision is audited.
- **A rejection always carries a reason**, enforced by the API and by a database
  constraint. The creator reads it on their dashboard.
- **Donations never touch us.** SOL moves wallet to wallet. The platform holds
  no key, takes no cut, and credits nothing until it has read the transaction
  back off the chain and seen the balances move.

## Layout

| Directory | Purpose |
| --- | --- |
| `backend/` | Go HTTP API — the only writer to the database |
| `auth/` | Go module: sign-in links, sessions, CSRF, wallet proofs |
| `frontend/` | Next.js application, including the role-gated review queue |
| `database/` | Postgres migrations and seed data |
| `docs/` | Architecture, workflow, security, decision records |
| `scripts/` | Developer tooling |

## Quick start

```bash
cp .env.example .env      # fill in DATABASE_URL and SESSION_SECRET
make setup                # install dependencies
make db-migrate           # apply migrations
make db-seed              # optional: an admin, two creators, a full queue
make dev                  # api :8085, web :3000
```

No email provider, object storage or SOL is needed to run it locally. Sign-in
links are printed to the API log, uploads are written to disk, and the chain is
only read. None of those shortcuts exist in production — the API refuses to
start there without the real thing.

To review submissions, make yourself an admin. Roles are granted in the
database on purpose, so no bug in an endpoint can create one:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Documentation

Start with [docs/workflow.md](docs/workflow.md) — it follows the path above end
to end and names the file that does each step. Then
[docs/auth.md](docs/auth.md) for how signing in and wallet proof work, and
[docs/security.md](docs/security.md) before touching authentication, uploads,
review or payment verification. [docs/README.md](docs/README.md) is the index.

## Design rules

Typography-led, monochrome with a single accent, no emoji anywhere. Layout
decisions live in [docs/design-system.md](docs/design-system.md); do not
introduce a new colour, radius or shadow without adding it there first.
