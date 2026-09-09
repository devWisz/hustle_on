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

Note what is **not** on that list: nobody's SOL. The platform holds no private
key. An attacker with full control of this API can lie about what the site
displays; they cannot take the money, because it never passes through here.

## Authentication

No password exists anywhere in the schema, so there is nothing to leak, reset or
reuse. Sign-in links and session tokens are stored as SHA-256 digests; the
plaintext lives only in a recipient's inbox or a browser cookie.

Full detail in [auth.md](auth.md). The properties that matter:

- `request-link` answers identically for every address, so it cannot be used to
  enumerate accounts.
- Links are single-use, enforced by `consumed_at IS NULL` inside the same
  `UPDATE` that reads the row — two concurrent requests race on the row lock.
- Accounts are created on verification, not on request, so an unverified address
  can never hold a handle.
- `next` must be a local path; absolute and protocol-relative values are
  rejected, or the emailed link becomes an open redirect.

## CSRF

Two independent checks, both required on every state-changing request:

1. `Origin` (or `Referer`) on the allowlist — set by the browser, unforgeable
   by a page.
2. `X-Sardhana-CSRF` matching an HMAC of this session's digest under
   `SESSION_SECRET`.

The CSRF cookie is readable by script on purpose — the frontend must echo it.
That is safe because it is derived server-side: planting a cookie value does not
produce the matching token.

CORS reflects only allowlisted origins. Credentials are allowed, which is
exactly why the origin is never reflected blindly.

## SQL

All SQL lives in `backend/internal/store`. Handlers call methods; they never
build queries. Every statement uses bound parameters, and string interpolation
into SQL is not permitted in the package. This is a structural property, not a
review checklist.

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

60 requests per minute per address by default; 5 sign-in attempts; 5 links per
email per hour.

`X-Forwarded-For` is honoured **only** when `TRUST_PROXY_HEADERS=true`, which
defaults to false. Trusting it with nothing in front to overwrite it lets any
client claim any address and walk past every per-address limit.

## Production refuses to degrade

`config.Load` will not start in production without a Resend key, without storage
credentials, or on any cluster other than `mainnet-beta`. A missing variable
fails loudly rather than silently weakening the deployment.

## Reporting a vulnerability

Email `security@sardhana.com`. Include what you did and what you observed.
Please do not open a public issue, and please do not test against other people's
accounts or content.
