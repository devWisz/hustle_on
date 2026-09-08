# Sardhana

**Your hustle should be paid off.**

Sardhana is a platform where builders publish timelapse videos of the work they
actually do, collect on-chain sponsorships from people who want that work to
continue, and get hired off the back of a public track record.

## What the platform does

- **Publish** — upload a timelapse of a work session; it becomes part of a public log.
- **Sponsor** — viewers send SOL or SPL tokens to a creator through an on-chain program.
- **Hire** — clients open escrowed engagements that release on delivery.
- **Discuss** — threaded comments on every video, moderated and rate limited.
- **Prove** — a profile is a verified history of shipped work plus linked X and GitHub accounts.

## Repository layout

| Directory    | Purpose |
| ------------ | ------- |
| `contracts/` | Solana program (Anchor, Rust) for sponsorships and hire escrow |
| `backend/`   | Go HTTP API — the only writer to the database |
| `auth/`      | Go module for email magic links (Resend), sessions and wallet proofs |
| `database/`  | Neon Postgres migrations, seeds and reference queries |
| `frontend/`  | Next.js public application |
| `admin/`     | Next.js moderation and payout console |
| `docs/`      | Architecture, security model, API reference, decision records |
| `scripts/`   | Developer tooling |

## Quick start

```bash
cp .env.example .env          # fill in Neon, Resend and Solana values
make setup                    # install per-workspace dependencies
make db-migrate               # apply migrations to the Neon branch in DATABASE_URL
make dev                      # backend :8085, frontend :3000, admin :3002
```

Read `docs/getting-started.md` for the long version and `docs/security.md`
before touching authentication, uploads or payment verification.

## Design rules

The interface is typography-led, monochrome with a single accent, and free of
decorative emoji. Layout decisions live in `docs/design-system.md`; do not
introduce a new colour, radius or shadow without adding it there first.
