<div align="center">

# Hustle On

**Rewards your hustle.**

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
| **Sponsorships are verified, not taken on trust** | SOL moves wallet to wallet with no custody, and a sponsorship is counted only once the chain confirms it |
| **Nothing is destroyed quietly** | The API cannot `DELETE` an account, a session or a sponsorship, and the audit trail refuses `UPDATE` and `DELETE` even from the owner |

## Project structure

```
hustleon/
├── backend/        # Go HTTP API, the only writer to the database
├── auth/           # Go module: wallet sign-in, sessions, CSRF, wallet proofs
├── frontend/       # Next.js app: public site, creator dashboard, admin console
├── database/       # Postgres migrations and seed data
├── contracts/      # Anchor sponsorship program (hustleon_pay)
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
- Report a session or a note to the admins, with a reason
- Search from anywhere with `⌘K` or `/`

**For admins only**
- Overview with the review queue, approval rate, 30-day activity and top creators
- A review desk with keyboard shortcuts (`j` `k` `a` `r`), quality flags and ready-made rejection notes
- A reports inbox: remove the note or take down the session in one step, or resolve and dismiss
- Feature sessions on the front page from the library
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

The console is also where live content is edited, because nobody else can:

| Surface | What it does |
|---|---|
| **Review desk** | Approve, send back with a reason, take down |
| **Library** | Edit any published session — title, summary, links, session length — or open it to replace its poster image |
| **Front page** | Choose which sessions are on the homepage and move them into the order you want; the shelf is capped at 12 so it stays a selection |
| **Reports** | Sessions and notes that people flagged, with the note attached |
| **Notes** | Every note on the site, with removal |
| **Members** | Search, suspend and reinstate; suspended accounts lose their sessions immediately |
| **Ledger** | Every sponsorship with its on-chain signature, the cluster it was verified against, whether the RPC endpoint is answering, and a re-check for one that has not confirmed |
| **Audit trail** | Every action above, filterable and exportable |

Editing something already published moves no status, so the audit line is what
makes it visible: it records which fields changed and what the front page looked
like before and after a reorder.

### Become an admin

Admin access is granted by the environment, not by a database row, so no bug in an
endpoint can create one. Put your Solana address in `ADMIN_WALLETS` and restart the
API: the first time that wallet signs in it is promoted to `role = 'admin'`, and
the promotion is written to the audit log. `ADMIN_WALLETS` is required in
production and validated at boot, so a typo stops the process with the offending
value named rather than leaving nobody able to reach the console.

## Cookies

Hustle On sets only essential cookies until you choose otherwise:

| Cookie | Purpose | Lifetime |
|---|---|---|
| `hustleon_session` | Keeps you signed in; `HttpOnly`, never readable by scripts | 30 days |
| `hustleon_session_csrf` | Double-submit token that protects every change you make | 30 days |
| `hustleon_guest` | Only if you choose **Continue as guest** on the sign-in page; a browsing preference that grants nothing | 12 hours |
| `hustleon_consent` | Remembers your cookie choice | 6 months |

A visitor who is not ready to sign in can choose **Continue as guest** and read
everything published. That mode is a display preference, not a second kind of
account: the API never sees the cookie, and uploading, commenting, saving and the
console all still require a session. Reaching one of them as a guest explains what
the account is for instead of bouncing to a form.

A banner on the first visit asks whether preferences (theme and recent searches)
may be remembered on the device. Choosing "Essential only" deletes them. The full
list is on the `/cookies` page, and the choice can be changed from **Cookie
settings** in the footer. Saved sessions are not one of those preferences: they
live on the account, on the server, and never in the browser.

## Security

The short version; [docs/security.md](docs/security.md) is the real one.

- **No passwords exist**, so none can leak. Sign-in is a Solana wallet signature
  over a single-use, short-lived nonce, and sessions are stored as SHA-256 digests.
- **Every state-changing request** passes one CSRF middleware (an allowlisted
  `Origin` plus a double-submit token bound to the session) before any handler runs.
- **Rate limits are per class of work**: reads, writes, uploads, sponsorships,
  sign-in and admin each have their own budget. Page renders forward the
  visitor's address with a shared secret, so limits apply per visitor, not to
  the web server as a whole.
- **Every list endpoint is paginated** with a capped page size and an opaque cursor.
- **Recordings live in a private bucket.** Neither a session nor its file can be
  read without a link the API signs, and signed links expire after two hours.
- **Content Security Policy with a per-request nonce**: only the app's own scripts
  run, and the browser may only talk to the API and the Solana RPC endpoint.
- **The API does not own the database.** It connects as its own login role,
  which inherits read and write access to the tables and nothing else: it cannot
  delete an account, a timelapse or a donation, cannot touch the audit trail or
  the migration ledger, and carries a statement timeout. `make preflight` checks
  all of that from the live connection, because a role name in an environment
  variable proves nothing about what the role can do.
- **Production refuses to degrade**: no admin wallet, no storage credentials or a
  non-mainnet cluster all fail at startup.

## Quick start

```bash
cp .env.example .env          # fill in DATABASE_URL, SESSION_SECRET, INTERNAL_PROXY_SECRET
make setup                    # install dependencies
make db-migrate               # apply migrations
make db-seed                  # optional: empties every table and creates nothing
scripts/create-api-role.sh --write-env   # the API's least-privilege login role
make dev                      # API on :8085, web on :3001
```

Locally there is nothing external to set up: sign-in is a wallet signature, so a
browser wallet is enough, and uploads write to disk. The dev seed creates no
accounts at all — put your own wallet in `ADMIN_WALLETS` and sign in with it to
get an operator account. None of these shortcuts exist in production.

Every list on the site is built from real records, so an empty site renders empty
states that say what will appear there. There is no fallback content and no
sample mode: if the API cannot be reached the page says so, and the browser is
never shown a session that nobody recorded. The first real session appears when
somebody uploads one and a reviewer approves it.

## Deploying

| Piece | Where | Key settings |
|---|---|---|
| API | Render, from `render.yaml` | `DATABASE_URL`, `WEB_PUBLIC_URL`, `CORS_ALLOWED_ORIGINS`, `SESSION_COOKIE_DOMAIN`, `ADMIN_WALLETS`, `HUSTLEON_PAY_PROGRAM_ID`, `INTERNAL_PROXY_SECRET`, `TRUSTED_PROXY_HOPS=1` |
| Web | Vercel, project root `frontend` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `INTERNAL_PROXY_SECRET` |
| Database | Neon | pooled URL for the API, direct URL for migrations |

The web app and the API must share a registrable domain (for example
`hustleon.com` and `api.hustleon.com`) so the sign-in cookie reaches both.
`NEXT_PUBLIC_API_URL` is baked in at build time, so redeploy the web app after
changing it. The full checklist is in [docs/deployment.md](docs/deployment.md).

## Sponsorships on chain

Sponsorships are recorded by the deployed Anchor program `hustleon_pay` when
`HUSTLEON_PAY_PROGRAM_ID` is set: the `sponsor` instruction moves the SOL, emits
an on-chain receipt anyone can read, and routes a platform fee to a treasury.
With the variable empty the API falls back to verifying a plain SOL transfer,
which is correct but leaves nothing on chain. Build, deploy and verification
detail is in [contracts/README.md](contracts/README.md).

## Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15.5, React 19, Tailwind CSS 4, GSAP |
| **Backend** | Go, net/http |
| **Database** | PostgreSQL on Neon |
| **Payments** | Solana (wallet to wallet, no custody); the `hustleon_pay` program records sponsorships on chain |
| **Auth** | Solana wallet signatures, CSRF tokens, digest-only sessions |

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
| [**docs/workflow.md**](docs/workflow.md) | Upload, review, publish and sponsor, end to end |

## Design principles

- **Typography-led**: a quiet palette with a single blue accent
- **No invented content, ever**: every record on the site was uploaded by a person and approved by a reviewer; empty states say so rather than filling the space
- **No emoji, no glow**: inline SVG icons; depth from shadow, border and motion
- **Motion with purpose**: GSAP reveals, split headings and counted figures, all of which collapse under `prefers-reduced-motion`
- **Responsive from 320px**: no horizontal scroll on any page
- **Accessible**: visible focus rings, labelled controls, content never hidden by an animation that might not run



<div align="center">

**Built for people who show their work.**

Developed by Sarjak Khanal

</div>
