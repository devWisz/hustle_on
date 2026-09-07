# Security

The platform holds three things worth attacking: people's accounts, their
money, and their published work. This document states what protects each, in
enough detail to be checked.

## Authentication

**No passwords exist.** Sign-in sends a single-use link. There is no password
hash to crack, no credential to reuse elsewhere, and no reset flow to abuse.

**Tokens are stored as digests.** Both magic-link and session tokens are 256
bits of entropy; only their SHA-256 digest is persisted. A database disclosure
yields nothing usable. SHA-256 rather than a password hash is deliberate: the
input is already high-entropy, so stretching would cost every request time and
buy nothing.

**Links are genuinely single-use.** Consumption is one statement —
`UPDATE ... WHERE consumed_at IS NULL AND expires_at > now() RETURNING ...` —
so two concurrent requests race on the row lock and only one wins.

**Enumeration is closed.** Requesting a link returns the same response and
takes the same path whether the address is unknown, active or suspended.

**Sessions are opaque and revocable.** The cookie is `HttpOnly` (an XSS bug
cannot exfiltrate it), `Secure`, `SameSite=Lax`, host-only and path-scoped.
Suspending an account revokes every live session in the same transaction as the
suspension.

## Cross-site request forgery

Two independent checks guard every state-changing request:

1. The `Origin` (or `Referer`) must be on the allowlist. This stops the request
   at the browser boundary.
2. The `X-Sardhana-CSRF` header must match an HMAC of the session digest, keyed
   by a server secret. A token lifted from another session does not verify.

Anonymous requests — asking for a login link, verifying one — have no session
to bind a token to, so the origin check stands alone there. That is covered by
tests in `auth/csrf_test.go`.

## Authorisation

Ownership is expressed in the SQL wherever it can be. Changing an application's
status joins through `jobs.client_id`; a guessed id belonging to someone else's
posting matches no row. This survives refactoring in a way that a separate
`if` statement does not.

Roles are three: member, moderator, admin. Moderators act on content; only
admins suspend or ban accounts, enforced in the API independently of what the
console offers.

## Payments

**Client claims are never trusted.** A reported signature only tells the API
where to look. Before any total moves, `internal/solana` fetches the
**finalized** transaction and checks the balance deltas: the recipient must
have gained at least the expected lamports, and the payer's balance must have
fallen. Reading the deltas rather than decoding instructions means a
transaction that emits convincing logs while transferring nothing does not pass.

**The destination comes from the server.** A sponsorship intent returns the
creator's payout address from our database. If the client chose it, a tampered
page could redirect money while still showing the creator's name.

**Confirmation is idempotent.** `ConfirmSponsorship` only matches rows not
already confirmed, so the request path and the background reconciler can both
run without double-crediting.

**On-chain limits are on chain.** `MAX_FEE_BPS` caps the platform fee at 10% in
the program. The treasury is pinned to the config account, so a caller cannot
pass their own account and collect the fee. No instruction lets the authority
move user funds; pausing blocks new deposits and never touches escrowed money.

## Wallets

Attaching a wallet requires signing a server-issued nonce. The message is
rebuilt on the server from the stored nonce before verification, so a signature
captured elsewhere cannot be replayed. A wallet address belongs to exactly one
account. The site never asks for a seed phrase or a private key, and says so on
the pages where someone might be phished.

## Uploads

Presigned PUT URLs are scoped to one object key under `uploads/<user id>/`,
expire in fifteen minutes, and sign the content type. The type allowlist is
video-only: an HTML or SVG file accepted here and served from a bucket origin
would be stored cross-site scripting. `OwnsKey` re-checks the prefix before a
database row is attached to an object.

## Input handling

Every request body is size-capped at 1 MiB, decoded with unknown fields
rejected, and validated before it reaches the database. Text is stripped of
control characters and measured in runes, not bytes. All SQL uses bound
parameters — string interpolation into SQL appears nowhere in `internal/store`,
which is what makes injection a structural impossibility rather than a review
finding.

## Rate limiting

A per-address token bucket protects the whole API; a tighter budget applies to
sign-in attempts and comment posting. `X-Forwarded-For` is only honoured when
`TRUST_PROXY_HEADERS=true`, because a spoofable header would let anyone
sidestep every per-address limit.

## Output and transport

The API returns JSON only, under a CSP of `default-src 'none'`. The web apps
ship an explicit CSP, `frame-ancestors 'none'`, `nosniff`, a referrer policy
and HSTS. React escapes all user text; nothing in the codebase renders
user-supplied HTML.

## Privacy

View deduplication uses a salted one-way digest of address, user agent, video
and date — enough to stop a refresh loop, not enough to identify a person.
Anonymous sponsorships are stripped in the store layer, so no handler can leak
the identity by forgetting to check. Query strings are excluded from request
logs because the login callback carries a token.

## What is deliberately not claimed

- The Anchor program has not been externally audited. That is a prerequisite
  for mainnet, listed in `contracts/README.md`.
- The rate limiter is per-process. A multi-instance deployment needs a limit at
  the edge as well; this is the last line, not the first.
- Social links are pinned to their platform's domain but verification of
  account *control* (proving the GitHub account is yours) is not implemented
  yet. Unverified links render without a check mark, and the accessible name
  says so.

## Reporting

security@sardhana.com. Acknowledgement within one business day. Please do not
test against other people's accounts or funds.
