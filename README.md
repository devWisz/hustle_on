<div align="center">

# Hustle On

**Your Hustle Matters.**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=nextdotjs)](https://nextjs.org)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Postgres](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)

Film yourself working on something you care about. Turn the recording into a
timelapse, write down what you did, upload it. A person reviews it. Once it is
live, viewers sponsor you in SOL wallet to wallet, or reach out to hire you.

</div>

## Quick start

```bash
cp .env.example .env                     # DATABASE_URL, SESSION_SECRET, ADMIN_EMAILS
make setup                               # install dependencies
make db-migrate                          # apply migrations
scripts/create-api-role.sh --write-env   # the API's least-privilege login role
make dev                                 # API on :8085, web on :3001
```

Nothing external is needed locally. Sign in with an email and password, or with a
browser wallet; uploads write to disk. Open <http://localhost:3001> — a browser
treats `localhost` and `127.0.0.1` as different sites, so mixing them means pages
render signed in while every action fails.

**To become an operator**, put your address in `ADMIN_EMAILS` (or your wallet in
`ADMIN_WALLETS`), restart, and sign up with it — or create the account directly:

```bash
cd backend && go run ./cmd/setpassword --email you@example.com --name "Your Name" --admin
```

It prints a generated password once. There is no sign-up for the first operator and
no reset link, because nothing is emailed; that command is how a password is set or
recovered.

The site is built from real records only. A fresh database renders empty states that
say what will appear — there is no sample content and no demo mode.

## How it works

```
record yourself ──▶ make a timelapse ──▶ upload with a write-up ──▶ [ human review ] ──▶ published
                                                                          │                 │
                                                                          └──▶ sent back    ▼
                                                                               with a reason  viewers sponsor
                                                                                              in SOL, direct
```

| Principle | How it is enforced |
|---|---|
| Nothing publishes itself | `published` is set by one statement behind the admin role, and every decision is audited |
| A refusal comes with a reason | The API and the database both refuse a rejection with no note, so a creator learns what to change |
| Sponsorships are verified, not trusted | SOL moves wallet to wallet with no custody, and counts only once the chain confirms it |
| Nothing is destroyed quietly | The API cannot delete an account or a sponsorship, and the audit trail refuses `UPDATE` and `DELETE` |

## Layout

```
├── backend/     # Go HTTP API — the only writer to the database
├── auth/        # Go module: sign-in rules, sessions, CSRF, wallet proofs
├── frontend/    # Next.js: the public site, the dashboard and the console
├── database/    # Postgres migrations
├── contracts/   # The Anchor sponsorship program, hustleon_pay
├── docs/        # Architecture, security, API, deployment
└── scripts/     # Migrations, preflight, the API role, the Solana deploy
```

## Documentation

| Document | What it covers |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | Setup, everyday commands, the end-to-end check |
| [docs/workflow.md](docs/workflow.md) | Upload, review, publish and sponsor, end to end |
| [docs/security.md](docs/security.md) | Threat model, cookies, CSRF, rate limits, database privileges |
| [docs/api.md](docs/api.md) | Endpoints, paging, error codes, rate-limit budgets |
| [docs/database.md](docs/database.md) | Schema, constraints, the application role, the audit trail |
| [docs/deployment.md](docs/deployment.md) | Render, Vercel, Neon and the launch checklist |
| [contracts/README.md](contracts/README.md) | Building, deploying and verifying the sponsorship program |

## Security

Passwords are Argon2id. Every state-changing request passes one CSRF middleware —
an allowlisted origin plus a double-submit token bound to the session. Rate limits
are per class of work, and page renders forward the visitor's address so limits
apply per visitor rather than to the web server. Recordings live in a private
bucket behind signed, expiring links. The API does not own the database: it
connects as a role that cannot delete an account, a timelapse or a donation,
cannot touch the audit trail, and carries a statement timeout. Production refuses
to start rather than degrade.

Report a vulnerability privately — see [SECURITY.md](SECURITY.md).

## Design

Typography-led, one accent colour, and no invented content ever: every record was
uploaded by a person and approved by a reviewer. No emoji, no glow. Responsive
from 320px, and every animation collapses under `prefers-reduced-motion`.
