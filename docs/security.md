# Security

Read this before touching authentication, uploads, review, or payment
verification.

## The shape of the trust

| Asset | Protected by | Compromise means |
| --- | --- | --- |
| Sessions | Digest-only storage, HttpOnly cookie, CSRF | Impersonation |
| Payout addresses | ed25519 proof, `UNIQUE`, paired `CHECK` | Donations redirected |
| The public feed | `requireAdmin` + `audit_log` | Unreviewed content published |
| Donations | On-chain re-verification, `UNIQUE` signature | Fabricated totals |
| Uploaded video | Presigned keys scoped to the owner | Cross-account writes |
| Creator records | Least-privilege database role, no `DELETE` | Destructive writes |
| The audit trail | Append-only trigger, no `UPDATE`/`DELETE` grant | Erased decisions |

Note what is **not** on that list: nobody's SOL. The platform holds no private
key. An attacker with full control of this API can lie about what the site
displays; they cannot take the money, because it never passes through here.

## Authentication

No password exists anywhere in the schema, so there is nothing to leak, reset or
reuse. Sign-in is a Solana wallet signature, and session tokens are stored as
SHA-256 digests; a session's plaintext lives only in a browser cookie. Nothing is
emailed, so there is no inbox to compromise and no third party in the path.

Full detail in [auth.md](auth.md). The properties that matter:

- `signin/challenge` looks up no account and answers identically for every
  address, so it cannot be used to enumerate accounts.
- Sign-in nonces are single-use, enforced by `consumed_at IS NULL` inside the
  same `UPDATE` that reads the row — two concurrent requests race on the row
  lock.
- An account is created only when a signature verifies, so an address that has
  proved nothing can never hold a handle or a session.
- `next` must be a local path; absolute and protocol-relative values are
  rejected, or a crafted link becomes an open redirect.

## Cookies

Two cookies, with the flags each one needs rather than the same flags for both.

| Cookie | HttpOnly | Why |
| --- | --- | --- |
| `hustleon_session` | **yes** | The credential. Unreachable from script, so an XSS bug cannot exfiltrate a session. |
| `hustleon_session_csrf` | no, on purpose | The frontend must read it to echo it back in a header. It is not a credential: it is an HMAC of the session digest, so planting a value does not produce the matching token. |
| `hustleon_guest` | no, on purpose | Set by the "Continue as guest" button and read by the server only to change copy. It is not sent to the API and unlocks nothing: a forged one buys the same browsing everyone already has, and every gated action is still refused on the session cookie. |

Both are `Secure` whenever the web app is served over https, `SameSite=Lax`,
`Path=/`, and host-only unless `SESSION_COOKIE_DOMAIN` says otherwise —
subdomains do not receive them by default. `SESSION_COOKIE_NAME` is validated as
an RFC 6265 token at startup, because a name is written into a `Set-Cookie`
header verbatim and a separator in it would turn the rest of the name into
attributes.

A session can outlive its CSRF cookie — a browser drops it, a stale tab holds an
old copy — and every write would then fail with an opaque 403 until the user
signed out and back in. When a valid session arrives without one, the API
reissues the CSRF cookie on that response. The request that lacked the token is
still refused; the next one works.

## CSRF

Two independent checks, both required on every state-changing request:

1. `Origin` (or `Referer`) on the allowlist — set by the browser, unforgeable
   by a page.
2. `X-Hustleon-CSRF` matching an HMAC of this session's digest under
   `SESSION_SECRET`.

Both live behind **one middleware** that runs before any handler, so protection
is a property of the API rather than of remembering to call a helper. A handler
cannot be reached without having passed it — which is why the check is no longer
repeated per endpoint.

A request that carries no session is protected by the origin check alone: there
is no session for a token to be bound to, and demanding one would make signing in
impossible. This keeps cross-site form posts from creating donation intents or
starting a sign-in challenge in a visitor's browser, which the origin check alone
stops.

CORS reflects only allowlisted origins. Credentials are allowed, which is
exactly why the origin is never reflected blindly.

## SQL and the database role

All SQL lives in `backend/internal/store`. Handlers call methods; they never
build queries. Every statement uses bound parameters, and string interpolation
into SQL is not permitted in the package. This is a structural property, not a
review checklist.

The API is also not the database owner. `0008_security_hardening` creates a
`sardhana_app` group role holding exactly the privileges the API uses, and the
deployment points `DATABASE_URL` at a login role that inherits it. On top of the
blanket grants:

- `DELETE` is revoked on `users`, `timelapses` and `donations`. Nothing in the
  API deletes them — creators withdraw and the row stays, because donations and
  audit lines reference it — so a bug or an injected statement cannot destroy
  creator history. The worst it can do is mark something removed, which is
  visible and reversible.
- `UPDATE` and `DELETE` are revoked on `audit_log`, and a trigger refuses both
  for every role including the owner.
- `schema_migrations` is not readable or writable by the API at all. An API that
  could edit it could convince the next deployment that a migration had run.
- `EXECUTE` on `recount_totals` and `purge_expired_auth` is revoked from `PUBLIC`
  — maintenance is a deliberate operator action.
- `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` and
  a pinned `search_path` are set on the role, so they hold on every connection
  rather than depending on which pooler backend answers.
- The role has a connection limit, so a runaway process cannot occupy the
  pooler's whole allowance.

Detail, and the exact steps to adopt it, in
[database.md](database.md#the-application-role).

## Uploads

The browser uploads directly to object storage. The API never sees the bytes;
what it controls is the URL.

- The object key embeds the owner's account id, and the signature covers it.
  Editing the URL into another prefix invalidates it.
- `media.OwnsKey` re-checks the prefix before a key is attached to any row.
- Content types are a strict allowlist and are part of the signature. This is a
  security control, not metadata: an HTML file accepted here and served from a
  bucket origin is stored cross-site scripting.
- Size is capped by `UPLOAD_MAX_BYTES` at both ends.
- The local development upload routes are registered **only** when no bucket is
  configured, so production never carries an unauthenticated write endpoint.

## Authorisation

`requireAdmin` gates every endpoint that can change what the public sees. Every
decision writes an `audit_log` row naming the actor, the subject and the reason.

Where existence is itself private, the answer is **404**, not 403:

- An unpublished timelapse, to anyone but its creator and an admin.
- The `/admin` page, to a signed-in member.

A 403 confirms that the thing exists.

Edge middleware redirects signed-out visitors away from private pages, but it
authorises nothing — the cookie's presence is only a hint. The real check runs
in the API on every request, against the session record. Middleware that decided
access on a cookie's existence would be bypassed by setting one.

## What is exposed

`internal/domain` is the wire contract. A column is invisible to clients until
someone adds a field for it deliberately. On top of that, `redactForPublic`
strips `reviewNote` and `submittedAt` from every public payload.

Public stats deliberately omit queue depth, so the site cannot be used to
measure how far behind review is.

## Privacy of viewers

Signed-out views are deduplicated by an HMAC of the caller's address, salted
with the date, under `SESSION_SECRET`. The address itself is never stored.
Tomorrow the same visitor hashes to something unrelated, so the table cannot
become a record of who watched what over time.

## Response headers

The API returns JSON only, so its policy is as tight as it goes:
`default-src 'none'; frame-ancestors 'none'; base-uri 'none'`, plus `nosniff`,
`DENY`, `no-referrer` and HSTS in production. The frontend sets its own CSP in
`middleware.ts`.

## Rate limiting

Each endpoint is charged against a named budget for its class of work — reading,
engaging, writing, uploading, donating, signing in, verifying, administering —
rather than every endpoint sharing one API-wide number. Without that split the
budget has to be as generous as the busiest route, which lets the most expensive
route to abuse (asking for a sign-in challenge, which is anonymous and cheap to
mint in bulk) run at the same rate as reading the feed. The route table names the
budget per route, so a new endpoint cannot be registered without one.

Sign-in and sign-in-token budgets are charged to the **address** even for a
signed-in caller; the rest are charged to the account id when there is a session
and to the address otherwise. A per-address ceiling wraps session resolution
itself, bounding the work one address can cause before we know who is asking, and
is deliberately loose so an office or a carrier NAT is not treated as one abusive
client.

One address is also capped by how many unspent sign-in challenges it may hold at
once, so a client cannot fill the table by requesting nonces in a loop.

Limits are per process, in memory: they are the last line of defence behind an
edge limiter, and a multi-instance deployment should also limit at the edge.

`X-Forwarded-For` is honoured **only** when `TRUST_PROXY_HOPS` is set to the
number of proxies you operate (or the older `TRUST_PROXY_HEADERS=true`, meaning
one). It defaults to zero, which means the TCP peer and no forwarded headers at
all. Trusting the header with nothing in front to overwrite it lets any client
claim any address and walk past every per-address limit. When it is trusted, the
*rightmost* entry is read, because everything to its left was supplied by the
client.

## Bounded responses

Every list endpoint is paginated and every `?limit=` has a maximum, so no request
can ask for an unbounded amount of work or an unbounded response body. Without a
cap, a single cheap request could return the entire table — a denial of service
that needs no payload at all.

The cursor is opaque and scoped to the query that issued it: a cursor from
another endpoint, or one that has been edited, is a `400` rather than a request
served from an arbitrary position. Paging is keyset, so page fifty costs what
page one costs.

The one exception is `/v1/admin/activity`, and it is bounded by its own `?days=`
window (7–90) instead.

## Production refuses to degrade

`config.Load` will not start in production without at least one `ADMIN_WALLETS`
address, without storage credentials, on any cluster other than `mainnet-beta`,
or with a `DATABASE_URL` whose `sslmode` would let the connection fall back to
plaintext. Session digests and payout addresses cross that connection, so TLS is
required rather than negotiated. A missing variable fails loudly rather than
silently weakening the deployment.

The same validation rejects a `SESSION_COOKIE_NAME` that is not a valid cookie
token and any rate-limit budget below 1 — a `0` is not "unlimited" here, it is a
value the operator did not intend.

## Reporting a vulnerability

Email `security@hustleon.com`. Include what you did and what you observed.
Please do not open a public issue, and please do not test against other people's
accounts or content.
