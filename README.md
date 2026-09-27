<div align="center">

# Sardhana

**Your hustle should be paid off.**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=nextdotjs)](https://nextjs.org)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Postgres](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)

---

Film yourself working on something you care about: a painting, a table, a jacket,
an app, a launch. Turn the recording into a timelapse, write down what you did,
and upload it. A person reviews it. Once it is live, viewers can sponsor you in
SOL, wallet to wallet, or get in touch to hire you.

</div>

## How it works

```
record yourself ──▶ make a timelapse ──▶ upload with a write-up ──▶ [ admin review ] ──▶ published
                                                                        │                 │
                                                                        └──▶ sent back     ▼
                                                                             with a reason  viewers sponsor
                                                                                            in SOL, direct
```

| Principle | How it's enforced |
|---|---|
| **Nothing publishes itself** | `published` is set by one statement behind the admin role, and every decision is audited |
| **Rejections carry a reason** | Enforced by the API and a database constraint; creators read it on their dashboard and can edit and resubmit |
| **Sponsorships never touch us** | SOL moves wallet to wallet: no keys held, no cut taken, verified on-chain before it is counted |
| **Nothing is destroyed quietly** | The API cannot `DELETE` an account, a session or a sponsorship, and the audit trail refuses `UPDATE` and `DELETE` even from the owner |

## Project structure

```
sardhana/
├── backend/        # Go HTTP API, the only writer to the database
├── auth/           # Go module: sign-in links, sessions, CSRF, wallet proofs
├── frontend/       # Next.js app: public site, creator dashboard, admin console
├── database/       # Postgres migrations and seed data
├── docs/           # Architecture, workflow, security, deployment, decision records
├── scripts/        # Developer tooling, including the seed generator
├── Dockerfile      # API image (build context is the repository root)
└── render.yaml     # Render blueprint for the API
```

## Features

**For creators**
- Upload with drag and drop, a live preview, and a checklist of what reviewers look for
- A dashboard with every submission, its status and the reviewer's note
- Edit and resubmit anything that was sent back, or withdraw a session at any time
- Sponsorships received, a verified payout wallet, and saved sessions

**For viewers**
- A feed with sorting, topic filters and "load more" pagination
- Watch pages with a proper player, timestamped notes, sponsors and share links
- Search from anywhere with `⌘K` or `/`

**For admins only**
- Overview with the review queue, approval rate, 30-day activity and top creators
- A review desk with keyboard shortcuts (`j` `k` `a` `r`), quality flags and ready-made rejection notes
- Library takedowns, member suspension (which signs the member out everywhere), a sponsorship ledger, notes moderation and an append-only audit trail
- CSV export on every table

## The admin console

The console at `/admin` is invisible to everyone else: anyone who is not signed
in as an admin gets the same 404 as a page that does not exist, and nothing in
the site links to it for them. Beyond holding the admin role, a request must pass:

| Check | Setting |
|---|---|
| The sign-in is recent | `ADMIN_SESSION_MAX_AGE_HOURS`, default `12`; older sessions are asked to sign in again |
| The request comes from an approved network (optional) | `ADMIN_ALLOWED_IPS`, a comma-separated list of addresses and CIDR ranges |
| Admin requests stay within their own rate limit | `RATE_LIMIT_ADMIN` |

Every decision (approve, send back, take down, suspend, reinstate, remove a
note) is written to the audit trail with who did it and what it was about.

### Become an admin

Roles are granted in the database on purpose, so no bug in an endpoint can create one:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Cookies

Sardhana sets only essential cookies until you choose otherwise:

| Cookie | Purpose | Lifetime |
|---|---|---|
| `sardhana_session` | Keeps you signed in; `HttpOnly`, never readable by scripts | 30 days |
| `sardhana_session_csrf` | Double-submit token that protects every change you make | 30 days |
| `sardhana_guest` | Only if you start the demo | 12 hours |
| `sardhana_consent` | Remembers your cookie choice | 6 months |

A banner on the first visit asks whether preferences (theme, recent searches,
saved sessions while signed out) may be remembered on the device. Choosing
"Essential only" deletes them. The full list is on the `/cookies` page, and the
choice can be changed from **Cookie settings** in the footer.

## Security

The short version; [docs/security.md](docs/security.md) is the real one.

- **No passwords exist**, so none can leak. Sign-in is a single-use emailed link,
  and sessions are stored as SHA-256 digests.
- **Every state-changing request** passes one CSRF middleware (an allowlisted
  `Origin` plus a double-submit token bound to the session) before any handler runs.
- **Rate limits are per class of work**: reads, writes, uploads, sponsorships,
  sign-in and admin each have their own budget. Page renders forward the
  visitor's address with a shared secret, so limits apply per visitor, not to
  the web server as a whole.
- **Every list endpoint is paginated** with a capped page size and an opaque cursor.
- **Content Security Policy with a per-request nonce**: only the app's own scripts
  run, and the browser may only talk to the API and the Solana RPC endpoint.
- **The API does not own the database.** It can connect as a least-privilege role
  that cannot drop tables, delete creator records or edit the audit trail.
- **Production refuses to degrade**: no Resend key, no storage credentials or a
  non-mainnet cluster all fail at startup.

## Quick start

```bash
cp .env.example .env          # fill in DATABASE_URL, SESSION_SECRET, INTERNAL_PROXY_SECRET
make setup                    # install dependencies
make db-migrate               # apply migrations
make db-seed                  # optional: a reviewer, eight creators and a full review queue
make dev                      # API on :8085, web on :3001
```

Locally there is no email provider, object storage or SOL to set up: sign-in
links print to the API log and uploads write to disk. None of these shortcuts
exist in production.

If the API cannot be reached, the site switches to a clearly labelled demo mode
with sample sessions so it never looks broken. Demo mode never includes the admin
console.

## Deploying

| Piece | Where | Key settings |
|---|---|---|
| API | Render, from `render.yaml` | `DATABASE_URL`, `WEB_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS`, `SESSION_COOKIE_DOMAIN`, `INTERNAL_PROXY_SECRET`, `TRUSTED_PROXY_HOPS=1` |
| Web | Vercel, project root `frontend` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `INTERNAL_PROXY_SECRET` |
| Database | Neon | pooled URL for the API, direct URL for migrations |

The web app and the API must share a registrable domain (for example
`sardhana.com` and `api.sardhana.com`) so the sign-in cookie reaches both.
`NEXT_PUBLIC_API_URL` is baked in at build time, so redeploy the web app after
changing it. The full checklist is in [docs/deployment.md](docs/deployment.md).

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15.5, React 19, Tailwind CSS 4, GSAP |
| **Backend** | Go, net/http |
| **Database** | PostgreSQL on Neon |
| **Payments** | Solana (wallet to wallet, no custody) |
| **Auth** | Magic links, CSRF tokens, wallet signature proofs |

## Documentation

| Document | What it covers |
|---|---|
| [**docs/workflow.md**](docs/workflow.md) | End-to-end path from upload to sponsorship |
| [**docs/auth.md**](docs/auth.md) | Sign-in flow and wallet proof verification |
| [**docs/security.md**](docs/security.md) | Cookies, CSRF, rate limits, database privileges |
| [**docs/api.md**](docs/api.md) | Endpoints, paging, error codes and rate-limit budgets |
| [**docs/database.md**](docs/database.md) | Schema, constraints, the application role and the audit trail |
| [**docs/deployment.md**](docs/deployment.md) | Render, Vercel, Neon and the launch checklist |
| [**docs/design-system.md**](docs/design-system.md) | Typography, colours, radii, shadows |

## Design principles

- **Typography-led**: a quiet palette with a single blue accent
- **No unlabelled fake data**: sample sessions appear only in demo mode, always tagged
- **No emoji, no glow**: inline SVG icons; depth from shadow, border and motion
- **Motion with purpose**: GSAP reveals, split headings and counted figures, all of which collapse under `prefers-reduced-motion`
- **Responsive from 320px**: no horizontal scroll on any page
- **Accessible**: visible focus rings, labelled controls, content never hidden by an animation that might not run

## Credits

Demo footage in `frontend/public/demo` is from [Pexels](https://www.pexels.com) under the
Pexels licence, shortened and sped up for the demo library.

---

<div align="center">

**Built for people who show their work.**

Developed by Sarjak Khanal

</div>
