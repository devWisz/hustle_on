# Architecture

```
                    ┌──────────────────────────────┐
   browser ────────▶│  frontend — Next.js 15        │
                    │  server components, /admin    │
                    └───────────────┬──────────────┘
                                    │ JSON over HTTP, cookie auth
                    ┌───────────────▼──────────────┐
                    │  backend — Go HTTP API        │
                    │  the only writer to Postgres  │
                    └───┬───────────┬───────────┬──┘
                        │           │           │
              ┌─────────▼──┐  ┌─────▼─────┐  ┌──▼─────────────┐
              │  Postgres  │  │  object   │  │  Solana RPC    │
              │  (Neon)    │  │  storage  │  │  (read-only)   │
              └────────────┘  └───────────┘  └────────────────┘
                                    ▲
                                    │ presigned PUT, direct from the browser
```

## The pieces

| Directory | What it is |
| --- | --- |
| `backend/` | Go HTTP API. The only process that writes to the database. |
| `auth/` | A separate Go module: sign-in links, sessions, CSRF, wallet proofs. |
| `frontend/` | Next.js application, including the role-gated review queue. |
| `database/` | Migrations, seed data, schema notes. |
| `docs/` | This. |
| `scripts/` | Developer tooling. |

## Why it is shaped this way

**One writer.** Every write goes through the Go API. Constraints, counters and
authorisation live in one place, so there is no second path that can leave the
database in a state the first one would have refused.

**`auth` is its own module.** It owns the rules and knows nothing about
Postgres; the backend implements `auth.Store` over it. That boundary is what
lets the sign-in rules be tested in memory, with no database at all — and those
are exactly the rules you want covered by tests that always run.

**SQL lives only in `internal/store`.** Handlers call methods; they never build
queries. Every statement uses bound parameters, and string interpolation into
SQL is not permitted in the package. Injection is off the table structurally
rather than by review.

**`internal/domain` is the wire contract.** JSON tags there are what clients
see, so a column added to the database stays invisible until somebody adds it to
a struct deliberately. That is how email addresses and review notes stay off
public payloads by default rather than by vigilance.

**The frontend renders on the server.** Pages fetch through `apiServer`, which
forwards the visitor's cookies, so a page sees exactly what that visitor is
allowed to see. It never throws: a page degrades to an empty state rather than a
crash when the API is briefly unavailable.

**Video does not pass through the API.** The browser uploads to object storage
with a presigned URL. The API controls the destination, not the bandwidth.

**The chain is read, never written.** Donations are signed by the donor's wallet
and broadcast by it. The API only reads transactions back to verify them, so it
holds no key that can move anyone's money.

## What is deliberately absent

No message queue, no cache layer, no microservices, no on-chain program. Each
would need to earn its place by solving a problem this product actually has, and
at present none of them do. The review queue is a `WHERE status = 'in_review'`
against a partial index; that is the correct amount of machinery for it.
