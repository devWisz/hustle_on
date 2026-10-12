<div align="center">

# Hustle On

**Rewards your hustle.**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=nextdotjs)](https://nextjs.org)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Postgres](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)

Film yourself working on something you care about: a painting, a table, a jacket, an
app, a launch. Turn the recording into a timelapse, write down what you did, and
upload it. A person reviews it. Once it is live, viewers can sponsor you in SOL,
wallet to wallet, or get in touch to hire you.

</div>

## Quick start

```bash
cp .env.example .env                     # fill in DATABASE_URL, SESSION_SECRET, ADMIN_EMAILS
make setup                               # install dependencies
make db-migrate                          # apply migrations
scripts/create-api-role.sh --write-env   # the API's least-privilege login role
make dev                                 # API on :8085, web on :3001
```

Nothing external is needed locally: sign in with an email address and password, or
with a browser wallet, and uploads write to disk. **Open the site at
<http://localhost:3001>** — `localhost` and `127.0.0.1` are different sites to a
browser's cookie rules, so mixing them means pages render signed in while every
action fails.

To give yourself the console:

```bash
# Operator: put your email in ADMIN_EMAILS, restart, and sign up with it — or
# with a wallet named in ADMIN_WALLETS — or create the account directly:
cd backend && go run ./cmd/setpassword --email you@example.com --name "Your Name" --admin
```

The second prints a generated password once. There is no sign-up for the first
operator and no reset link, because nothing is emailed — that command is how a
password is set or recovered. Your own credentials live in the gitignored
`ADMIN-ACCESS.md`; the Solana deployment playbook is in the gitignored `solana.md`.

The site is built entirely from real records, so a fresh database renders empty
states that say what will appear. There is no sample content and no demo mode: the
first session appears when somebody uploads one and a reviewer approves it.

## How it works

```
record yourself ──▶ make a timelapse ──▶ upload with a write-up ──▶ [ admin review ] ──▶ published
                                                                        │                 │
                                                                        └──▶ sent back     ▼
                                                                             with a reason  viewers sponsor
                                                                                            in SOL, direct
```

| Principle | How it is enforced |
|---|---|
| **Nothing publishes itself** | `published` is set by one statement behind the admin role, and every decision is audited |
| **A refusal comes with a reason** | The API refuses a rejection with no note and so does the database, so a creator always learns what to change and can resubmit |
| **Sponsorships are verified, not taken on trust** | SOL moves wallet to wallet with no custody, and a sponsorship counts only once the chain confirms it |
| **Nothing is destroyed quietly** | The API cannot `DELETE` an account, a session or a sponsorship, and the audit trail refuses `UPDATE` and `DELETE` even from the owner |

## Features

**Creators** — sign in with an email address and password or a Solana wallet, and
link a payout wallet only when you are ready to be paid. Upload with drag and drop,
a live preview and a checklist of what reviewers look for. Track every submission
and its reviewer's note, edit and resubmit anything sent back, withdraw a session at
any time, and see the sponsorships you have received.

**Viewers** — a feed with sorting, topic filters and load-more pagination; watch
pages with a real player, timestamped notes, supporters and share links; reporting
with a reason; and `⌘K` search from anywhere.

**Operators** — an overview with the review queue, approval rate and 30-day
activity; a review desk driven by `j` `k` `a` `r`; a reports inbox; front-page
curation; library editing; member suspension; a sponsorship ledger; notes
moderation; an append-only audit trail; and CSV export on every table.

## Sponsorships on chain

The Anchor program `hustleon_pay` records sponsorships when
`HUSTLEON_PAY_PROGRAM_ID` is set: the `sponsor` instruction moves the SOL, emits an
on-chain receipt anyone can read, and routes a platform fee to a treasury. With the
variable empty the API falls back to verifying a plain SOL transfer — correct, but
it leaves nothing on chain.

The API only credits a sponsorship it can find on the chain, and it applies one
rule chosen by that same setting, so a donor cannot pick the cheaper one. Build,
deploy and verification detail, including a local-validator recipe that costs
nothing, is in [contracts/README.md](contracts/README.md).

## The admin console

`/admin` is invisible to everyone else: anyone not signed in as an admin gets the
same 404 as a page that does not exist, and nothing links to it for them. Beyond
holding the role, a request must pass:

| Check | Setting |
|---|---|
| The sign-in is recent | `ADMIN_SESSION_MAX_AGE_HOURS`, default `12` |
| The request comes from an approved network (optional) | `ADMIN_ALLOWED_IPS`, addresses or CIDR ranges |
| Admin traffic stays inside its own rate limit | `RATE_LIMIT_ADMIN` |

Admin access is granted by the environment rather than by a database row, so no
endpoint bug can create one: an account listed in `ADMIN_WALLETS` (by wallet) or
`ADMIN_EMAILS` (by email) is promoted when it signs in, and the promotion is audited
with the variable that granted it. The variable is required in production and
validated at boot, so a typo stops the process with the offending value named
instead of leaving nobody able to reach the console.

The console is also the only place live content is edited — title, summary, links,
session length and poster image on any published session; which sessions appear on
the front page and in what order, capped at 12 so the shelf stays a selection; the
review desk; reports; notes; members; the ledger; and the audit trail. Editing
something already published moves no status, so the audit line is what makes it
visible: it records which fields changed and how the front page looked before and
after a reorder.

## Security

The short version — [docs/security.md](docs/security.md) is the real one.

- **Passwords are real credentials, and hashed.** Email + password sign-in stores
  an Argon2id hash (`m=64 MiB, t=3, p=1`) with a random salt per password in a PHC
  string that carries its own parameters. The most common passwords are refused
  outright, because a length rule alone pushes people towards `passwordpassword`,
  which is long and worthless. Login refusals are identical for a wrong password,
  an unknown address and a wallet-only account, and an unknown address still costs
  a real hash verification, so neither the message nor the timing says whether an
  account exists. There is **no password reset**: nothing is emailed, so a
  forgotten password is changed while signed in or set by an operator with
  `backend/cmd/setpassword`.
- **Every state-changing request** passes one CSRF middleware — an allowlisted
  `Origin` plus a double-submit token bound to that session — before any handler
  runs. The allowlist treats `localhost`, `127.0.0.1` and `[::1]` as one address,
  and that exception is confined to loopback on both sides so no other origin is
  ever matched loosely.
- **Rate limits are per class of work**: reads, writes, uploads, sponsorships,
  sign-in, sign-up and admin each have their own budget. Page renders forward the
  visitor's address behind a shared secret, so limits apply per visitor rather than
  to the web server as a whole.
- **Every list endpoint is paginated** with a capped page size and an opaque
  cursor, and every list reaches it: a ranked feed tab cannot silently stop at
  twelve.
- **Recordings live in a private bucket.** Neither a session nor its file is
  readable without a link the API signs, and signed links expire.
- **Content Security Policy with a per-request nonce**, so only the app's own
  scripts run and the browser may talk only to the API and the Solana RPC endpoint.
- **Suspension takes effect immediately** — the member's sessions are revoked and
  every request re-checks that the account is active.
- **The API does not own the database.** It connects as its own login role, which
  inherits read and write access to the tables and nothing else: it cannot delete
  an account, a timelapse or a donation, cannot touch the audit trail or the
  migration ledger, and carries a statement timeout. `make preflight` asserts all
  of that from the live connection, because a role name in an environment variable
  proves nothing about what the role can do.
- **Production refuses to degrade**: no operator wallet, no storage credentials or
  a non-mainnet cluster all fail at startup.

## Cookies

Only essential cookies, until you choose otherwise:

| Cookie | Purpose | Lifetime |
|---|---|---|
| `hustleon_session` | Keeps you signed in; `HttpOnly`, never readable by scripts | 30 days |
| `hustleon_session_csrf` | Double-submit token protecting every change you make | 30 days |
| `hustleon_guest` | Only if you choose **Continue as guest**; a browsing preference that grants nothing | 12 hours |
| `hustleon_consent` | Remembers your cookie choice | 6 months |

A visitor who is not ready to sign in can choose **Continue as guest** and read
everything published. That mode is a display preference, not a second kind of
account — the API never sees the cookie, and uploading, sponsoring, commenting,
saving and the console all still require a session. Reaching one of them as a guest
explains what the account is for rather than bouncing to a form.

A first-visit banner asks whether preferences (theme and recent searches) may be
remembered on the device; "Essential only" deletes them. The full list is on
`/cookies`, and the choice can be changed from **Cookie settings** in the footer.
Saved sessions are not a preference: they live on the account, on the server, and
never in the browser.

## Project structure

```
├── backend/     # Go HTTP API — the only writer to the database
├── auth/        # Go module: sign-in rules, sessions, CSRF, password policy, wallet proofs
├── frontend/    # Next.js: the public site, the creator dashboard and the admin console
├── database/    # Postgres migrations and the development seed
├── contracts/   # The Anchor sponsorship program, hustleon_pay
├── docs/        # Architecture, workflow, security, deployment and decision records
├── scripts/     # Migrations, preflight, the API role, the Solana deploy
├── Dockerfile   # API image; the build context is the repository root
└── render.yaml  # Render blueprint for the API
```

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15.5, React 19, Tailwind CSS 4, GSAP |
| **Backend** | Go, `net/http` |
| **Database** | PostgreSQL on Neon |
| **Payments** | Solana, wallet to wallet with no custody; the `hustleon_pay` program records sponsorships on chain |
| **Auth** | Email + password (Argon2id) or wallet signatures, CSRF tokens, digest-only sessions |

## Deploying

| Piece | Where | Key settings |
|---|---|---|
| API | Render, from `render.yaml` | `DATABASE_URL`, `WEB_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS`, `SESSION_COOKIE_DOMAIN`, `ADMIN_WALLETS`/`ADMIN_EMAILS`, `HUSTLEON_PAY_PROGRAM_ID`, `INTERNAL_PROXY_SECRET`, `TRUSTED_PROXY_HOPS=1` |
| Web | Vercel, project root `frontend` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `INTERNAL_PROXY_SECRET` |
| Database | Neon | a pooled URL for the API, a direct URL for migrations |

The web app and the API must share a registrable domain (`hustleon.com` and
`api.hustleon.com`, say) so the session cookie reaches both. `NEXT_PUBLIC_API_URL`
is baked in at build time, so redeploy the web app after changing it. The full
checklist is in [docs/deployment.md](docs/deployment.md).

## Documentation

| Document | What it covers |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | Setup, the everyday commands, and the end-to-end check |
| [docs/workflow.md](docs/workflow.md) | Upload, review, publish and sponsor, end to end |
| [docs/auth.md](docs/auth.md) | Both sign-in paths, sessions and wallet proofs |
| [docs/security.md](docs/security.md) | Threat model, cookies, CSRF, rate limits, database privileges |
| [docs/api.md](docs/api.md) | Endpoints, paging, error codes and rate-limit budgets |
| [docs/database.md](docs/database.md) | Schema, constraints, the application role and the audit trail |
| [docs/architecture.md](docs/architecture.md) | How the pieces fit together |
| [docs/deployment.md](docs/deployment.md) | Render, Vercel, Neon and the launch checklist |
| [docs/design-system.md](docs/design-system.md) | Typography, colours, radii, shadows |
| [docs/adr/](docs/adr/) | Decision records, including the ones that were superseded |

## Design principles

- **Typography-led**: a quiet palette with a single blue accent
- **No invented content, ever**: every record was uploaded by a person and approved
  by a reviewer; empty states say so rather than filling the space
- **No emoji, no glow**: inline SVG icons, with depth from shadow, border and motion
- **Motion with purpose**: GSAP reveals, split headings and counted figures, all of
  which collapse under `prefers-reduced-motion`
- **Responsive from 320px**: no horizontal scroll on any page
- **Accessible**: visible focus rings, labelled controls, and content never hidden
  behind an animation that might not run

<div align="center">

**Built for people who show their work.**

Developed by Sarjak Khanal

</div>
