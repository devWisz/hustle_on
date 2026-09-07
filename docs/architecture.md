# Architecture

```
                    ┌──────────────┐        ┌──────────────┐
  browser  ────────▶│  frontend    │        │   admin      │◀──── operator
                    │  Next.js     │        │   Next.js    │
                    └──────┬───────┘        └──────┬───────┘
                           │  JSON over HTTPS, session cookie
                           ▼                       ▼
                    ┌──────────────────────────────────────┐
                    │            backend (Go)              │
                    │  routing · authz · validation · SQL  │
                    └───┬───────────┬──────────────┬───────┘
                        │           │              │
              ┌─────────▼──┐  ┌─────▼──────┐  ┌────▼─────────┐
              │  Neon      │  │ object     │  │ Solana RPC   │
              │  Postgres  │  │ storage    │  │              │
              └────────────┘  └─────┬──────┘  └────┬─────────┘
                                    │              │
   browser ─── presigned PUT ───────┘              │
   wallet  ─── signed transaction ─────────────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │ sardhana_pay    │
                                          │ Anchor program  │
                                          └─────────────────┘
```

## The shape of it

**One writer.** The Go API is the only process that writes to Postgres. The
frontends hold no connection string and no service credential. Every rule about
who may change what is expressed once, in one codebase.

**Bytes go around the API, not through it.** Video uploads travel from the
browser straight to object storage using a URL the API signs for one specific
object. A two-gigabyte upload never occupies an API process, and the storage
credentials never leave the server.

**Money goes around the API too, but is verified by it.** A sponsor's wallet
signs a transfer directly to the creator. The API's role is to say what should
be paid and then to check, against the cluster, that it was. Nothing is
credited on a client's word.

**Two frontends, not one with a role switch.** The admin console is a separate
application with its own bundle and a tighter CSP. A bug in a public page
cannot reach moderation code that was never shipped to it.

## Why these technologies

**Go for the backend.** The workload is IO-bound request handling with
background reconciliation. Go's standard library covers HTTP, TLS, crypto and
scheduling without a framework, which keeps the dependency surface — and the
supply-chain surface — small. Deployment is one static binary.

**Anchor for the program.** Sponsorships and escrow need on-chain rules that
anyone can read and verify. Anchor gives account validation, a generated IDL
and a serialisation format clients can rely on.

**Next.js for the frontends.** Server components let a page render with the
viewer's session already resolved, so there is no flash of signed-out UI and no
client fetch waterfall before first paint.

**Neon for Postgres.** Branching gives every pull request a real database that
is a copy-on-write clone rather than a fixture, and scale-to-zero keeps idle
environments free. Its transaction pooler shapes two decisions in the code: the
API uses the pooled endpoint with prepared statements disabled, and migrations
use the direct one.

**Resend for email.** Sign-in is the only transactional email path that matters,
and it needs deliverability, not a marketing platform.

## Request lifecycle

1. `recoverPanic` catches anything the layers below throw.
2. `requestID` assigns an id and echoes it in `X-Request-Id`.
3. `logRequests` records method, path (never the query string, which can carry
   a login token), status and duration.
4. `securityHeaders` sets a JSON-only CSP and the transport headers.
5. `cors` answers only for allowlisted origins.
6. `rateLimit` applies a per-address token bucket.
7. `attachSession` resolves the session cookie onto the context. It never
   rejects; routes decide what they require.
8. The handler runs, returning an error rather than writing one.

## Background work

`internal/worker.ReconcilePayments` polls for transactions that were submitted
but never confirmed through the API, and settles them from the chain. Without
it a sponsor closing their tab mid-flow would leave a creator uncredited for
money that is provably on chain.
