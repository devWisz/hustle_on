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
| [**docs/security.md**](docs/security.md) | Security model for auth, uploads, review, payments |
| [**docs/design-system.md**](docs/design-system.md) | Typography, colors, radii, shadows |
| [**docs/README.md**](docs/README.md) | Full documentation index |

## Design principles

- **Typography-led** — monochrome palette with a single green accent
- **No emoji** — inline SVG icons only, consistent across every platform
- **Glassmorphism & micro-animations** — premium feel with frosted-glass cards, staggered reveals, gradient accents
- **Accessibility first** — visible focus rings, ARIA labels, `prefers-reduced-motion` respected
- **New colors, radii, or shadows** must be added to [docs/design-system.md](docs/design-system.md) first

---

<div align="center">

**Built for creators who show their work.**

</div>
