<div align="center">

# Sardhana

**Timelapses of real work, funded by the people who want to see more of it.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)](https://nextjs.org)
[![Go](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Postgres](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)

---

Record a session. Write down what you actually did. Point at the code.  
A person reads it. If it holds up, viewers fund the work in SOL — wallet to wallet.

</div>

## How it works

```
record ──▶ write up ──▶ submit ──▶ [ human review ] ──▶ published
                                         │                   │
                                         └──▶ declined       ▼
                                              with reason   viewers donate
                                                            in SOL, direct
```

Three properties hold it together:

| Principle | How it's enforced |
|---|---|
| **Nothing publishes itself** | `published` is set by one statement, behind the admin role, every decision audited |
| **Rejections carry a reason** | Enforced by the API and a database constraint — creators read it on their dashboard |
| **Donations never touch us** | SOL moves wallet to wallet — no keys held, no cut taken, verified on-chain before credited |
| **Nothing is destroyed quietly** | The API cannot `DELETE` an account, a timelapse or a donation, and the audit trail refuses `UPDATE` and `DELETE` even from the owner |

## Project structure

```
sardhana/
├── backend/        # Go HTTP API — the only writer to the database
├── auth/           # Go module: sign-in links, sessions, CSRF, wallet proofs
├── frontend/       # Next.js 15 app with premium UI & role-gated review queue
├── database/       # Postgres migrations and seed data
├── docs/           # Architecture, workflow, security, decision records
└── scripts/        # Developer tooling
```

## Looking around first

Nothing about the product is hidden behind the sign-in form. **Look around
first** on the home page starts a guest preview: the feed, a watch page, a
creator profile, the creator dashboard, the submission form and the account
settings all open, filled in with clearly labelled sample records wherever there
is nothing real to show.

The cookie that turns it on is a rendering preference, not a credential — it
unlocks nothing on the API, which still answers an unauthenticated request the
way it always did. Writing anything still needs an account, because a submission
has to belong to somebody a reviewer can write back to. See
[docs/guest-preview.md](docs/guest-preview.md).

## Quick start

```bash
# 1. Configure environment
cp .env.example .env          # fill in DATABASE_URL and SESSION_SECRET

# 2. Install & prepare
make setup                    # install all dependencies
make db-migrate               # apply database migrations
make db-seed                  # optional: seed an admin, two creators, a full queue

# 3. Run
make dev                      # api on :8085, web on :3000
```

> **Zero external dependencies for local dev.** No email provider, object storage, or SOL needed.
> Sign-in links print to the API log, uploads write to disk, and the chain is read-only.
> None of these shortcuts exist in production — the API refuses to start without the real thing.

### Become an admin

Roles are granted in the database on purpose, so no bug in an endpoint can create one:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Security

The short version; [docs/security.md](docs/security.md) is the real one.

- **No passwords exist**, so none can leak. Sign-in is a single-use emailed link,
  and sessions are stored as SHA-256 digests — a dump of the sessions table
  grants nobody a session.
- **Session cookies are `HttpOnly`**, `Secure` over https and `SameSite=Lax`; the
  separate CSRF cookie is script-readable on purpose and is not a credential.
- **Every state-changing request** passes one CSRF middleware — an allowlisted
  `Origin` plus a double-submit token bound to the session — before any handler
  can run. There is no per-endpoint opt-in to forget.
- **Rate limits are per class of work**, not per API, so requesting a sign-in
  link (which sends mail) is not budgeted like reading the feed. Sign-in budgets
  are charged to the address even when a session is present.
- **Every list endpoint is paginated** with a capped page size, and the cursor is
  opaque and scoped to its query, so no request can ask for an unbounded response.
- **The API does not own the database.** It connects as a least-privilege role
  that cannot drop tables, cannot delete creator records, and holds no write
  privilege at all on the audit trail.
- **Maintenance is deliberate**: `statement_timeout`, `lock_timeout` and a pinned
  `search_path` are set on the role, and the repair functions are the owner's.
- **Production refuses to degrade** — no Resend key, no storage credentials, a
  non-mainnet cluster, or a `DATABASE_URL` that would fall back to plaintext all
  fail at startup rather than silently weakening the deployment.

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, Tailwind CSS 4 |
| **Backend** | Go, net/http |
| **Database** | PostgreSQL |
| **Payments** | Solana (wallet-to-wallet, no custody) |
| **Auth** | Magic links, CSRF tokens, wallet signature proofs |

## Documentation

| Document | What it covers |
|---|---|
| [**docs/workflow.md**](docs/workflow.md) | End-to-end path from upload to donation |
| [**docs/auth.md**](docs/auth.md) | Sign-in flow and wallet proof verification |
| [**docs/security.md**](docs/security.md) | Security model: cookies, CSRF, rate limits, database privileges |
| [**docs/api.md**](docs/api.md) | Endpoints, paging, error codes and rate-limit budgets |
| [**docs/database.md**](docs/database.md) | Schema, constraints, the application role and the append-only audit trail |
| [**docs/design-system.md**](docs/design-system.md) | Typography, colors, radii, shadows |
| [**docs/README.md**](docs/README.md) | Full documentation index |

## Design principles

- **Typography-led** — monochrome palette with a single green accent
- **No unlabelled fake data** — sample records live in guest preview only, always tagged, always beaten by real data
- **No emoji** — inline SVG icons only, consistent across every platform
- **No glow** — depth comes from shadow, border and motion, never a coloured halo
- **Motion with one curve** — staggered reveals, counted figures, a press on every button; all of it collapses under `prefers-reduced-motion`
- **Responsive from 320px** — fluid type, rows that stack before they crush, no horizontal scroll
- **Accessibility first** — visible focus rings, ARIA labels, content never hidden by an animation that might not run
- **New colors, radii, or shadows** must be added to [docs/design-system.md](docs/design-system.md) first

---

<div align="center">

**Built for creators who show their work.**

</div>
