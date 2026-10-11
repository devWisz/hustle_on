# Authentication

Hustle On has two wallet signatures, and they answer different questions.

| Signature | Answers | Lives in |
| --- | --- | --- |
| **Sign-in** | Who is this account? | `auth/signin.go`, `auth/session.go` |
| **Payout proof** | Which key should be paid? | `auth/wallet.go` |

They are deliberately separate. The message a wallet signs to sign in names the
product and the site, carries a one-time nonce, and — in as many words —
authorises no transfer and moves no funds. Recording a payout address is a
second, different proof over a message the server rebuilds from its own stored
nonce, so the signature that got somebody signed in is not the signature that
decides where their SOL goes. The payout address is pinned to a key, and
claiming one already held elsewhere is a conflict rather than a transfer.

There is no password anywhere in the system. There is no column for one, so
there is nothing to leak, reset, reuse across sites, or phish.

---

## Signing in

```
  POST /v1/auth/signin/challenge      { address }
       │  a nonce is generated and stored against the address;
       │  the exact text to sign comes back
       ▼
  wallet.signMessage(message)         ← authorises no transfer
       │
       ▼
  POST /v1/auth/signin/verify         { address, nonce, signature, issuedAt }
       │  signature checked, nonce consumed atomically,
       │  the account is found or created
       ▼
  Set-Cookie: hustleon_session       (HttpOnly, Secure, SameSite=Lax)
  Set-Cookie: hustleon_session_csrf  (readable, by design)
```

### What each step guarantees

**The challenge is not a directory.** `signin/challenge` looks up no account. It
answers identically for an address that has one and an address that has never
been seen, so it cannot be asked "does this wallet have an account here?"

**The message is rebuilt on the server.** The text to sign is rendered from the
stored nonce and the address rather than accepted from the request, so a caller
cannot present a signature over text of their own choosing and have it count.
It names the product and the site's origin, which makes it meaningless anywhere
else: a signature harvested by a lookalike cannot be replayed here.

**The nonce is single-use.** `ConsumeSignInChallenge` marks the challenge spent
inside the same `UPDATE` that reads it, with `consumed_at IS NULL` in the
predicate. Two concurrent presentations of the same signature race on the row
lock and only the first gets a row back. A signature is not a secret, so this is
the only thing standing between a captured one and a second session.

**The signature is checked before the nonce is spent.** A wallet that signed
slightly different text — a dropped character, a trimmed newline — does not burn
the challenge and force the person to start again. It is still single-use: only a
verified request reaches the consume, and a replay loses the race above.

**Five minutes.** `SIGNIN_CHALLENGE_TTL_MINUTES` (default 5) is how long a nonce
stays signable. Short on purpose: it only has to outlive the moment between the
request and the signature.

**Sign-up and sign-in are the same act.** An address that has never been seen
gets an account in the same request, because the signature that proves who they
are is the same signature that would be needed to claim a pre-made account. A
challenge for an address nobody controls creates nothing, so an unverified
address can never occupy a handle or a session.

**`next` must be a local path.** The login page runs it through `safeNext`,
which accepts only a single-slash path and rejects protocol-relative `//host`
and backslash forms. Without that check, a crafted `?next=` is an open redirect
that lands a freshly signed-in visitor on somebody else's page.

---

## Staying signed in

The session cookie carries a random token. The database stores only its digest,
alongside the account, an expiry, and the address and user agent it was issued
to.

The cookie's flags are the security model, not decoration:

- **`HttpOnly`** — no script on the page can read it, so an XSS bug cannot
  exfiltrate a session.
- **`Secure`** — it never crosses a plaintext connection.
- **`SameSite=Lax`** — a cross-site `POST` cannot carry it, while an ordinary
  top-level navigation still can.
- **Host-only** (`Path=/`, no `Domain`) — subdomains never receive it.

`attachSession` resolves the cookie on every request and puts the account on the
request context. It never rejects: routes decide what they require, so a public
page and a private one run the same middleware.

`last_used_at` is written at most hourly. Recording it on every request would
turn every read into a write.

---

## CSRF

Two independent checks have to pass on every state-changing request. Either one
alone has known bypasses; together they do not.

1. **Origin.** The `Origin` header (falling back to `Referer`) must be on the
   configured allowlist. The browser sets this and a page cannot forge it.
2. **Double-submit token.** `X-Hustleon-CSRF` must match an HMAC of this exact
   session's digest, keyed by `SESSION_SECRET`.

The CSRF cookie is intentionally *not* `HttpOnly` — the frontend has to read it
to echo it back. That is safe because it is derived from the session under a
server-side key: an attacker who can plant a cookie value still cannot produce
the matching token.

Both checks run in a single middleware in front of the whole API rather than in
each handler, so a new state-changing endpoint is covered by existing rather than
by remembering. A request with no session — asking for a sign-in challenge — is
protected by the origin check alone, since there is no session to bind a token to.

If a valid session arrives without its CSRF cookie, the API reissues it on that
response. The request that lacked the token is still a 403; the next one works,
instead of the user being stuck until they sign out and back in.

CORS is configured to reflect only allowlisted origins. Credentials are
permitted, which is precisely why the `Origin` is never reflected blindly.

---

## Proving a payout wallet

```
  POST /v1/me/wallet/challenge  { address }
       │  server stores a nonce, returns the exact text to sign
       ▼
  wallet.signMessage(...)       ← authorises no transfer
       │
       ▼
  POST /v1/me/wallet/verify     { address, nonce, signature, issuedAt }
       │  nonce consumed atomically, ed25519 signature checked
       ▼
  users.payout_address = address, payout_verified_at = now()
```

The message is rebuilt on the server from the stored nonce. It is never taken
from the request, so a caller cannot get a signature over text of their own
choosing accepted as proof of ownership.

`users.payout_address` is `UNIQUE`, and the schema requires the address and its
verification timestamp to be set together:

```sql
CHECK ((payout_address IS NULL) = (payout_verified_at IS NULL))
```

An address therefore belongs to exactly one account, and no code path can record
one without the proof that established it. Claiming an address already held
elsewhere is a conflict, not a transfer.

**Hustle On never asks for a seed phrase or a private key** — not to sign in, not
to receive payouts, not for support. Any page that does is not ours.

---

## Roles

There are two: `member` and `admin`. That is the whole model.

A member publishes and receives donations. An admin can additionally decide
what reaches the public feed. Every admin-only endpoint goes through
`requireAdmin`, and every decision one makes is written to `audit_log` with the
actor, the subject and the reason.

The frontend's `/admin` page returns **404**, not 403, to a signed-in member. A
403 confirms that the page exists.

Admin access is a property of the environment, not of a database row. A wallet
listed in `ADMIN_WALLETS` is promoted to `role = 'admin'` the first time it signs
in, and the promotion is written to `audit_log` with `source: ADMIN_WALLETS`.
There is no endpoint that promotes an account, so a bug in one cannot create an
admin — and because the list lives in the environment, restoring a backup or
provisioning a new deployment cannot silently drop the only person who can
review anything. Every address is validated at boot and `config.Load` refuses to
start a production process without at least one, so a typo names the offending
value instead of leaving nobody able to reach the console.

---

## The profile step

The first sign-in creates the account: a generated placeholder handle and a
display name identical to it. The handle is generated rather than asked for,
because a form between somebody and the account they have just proved they own is
ceremony, and the handle is public decoration that onboarding replaces a moment
later. That much is enough to own a session and not enough to be credited for
one, so the name is asked for immediately afterwards, once
(`users.onboarded_at`). Everything in it is public and editable later; an account
that has not been through it is sent to `/welcome` before it can upload or open
its dashboard, rather than publishing work under a name nobody chose.

## Wallet linking

The payout address is proved by a signature, never by typing an address in:

1. `POST /v1/me/wallet/challenge` stores a nonce and returns the exact message to
   sign. The message is rebuilt on the server from the stored nonce, so a
   signature over text of the caller's choosing proves nothing.
2. `POST /v1/me/wallet/verify` checks the ed25519 signature against the address,
   and only then spends the nonce.

That order matters. The nonce is consumed *after* verification, so one rejected
attempt — a wallet that signed slightly different text, a paste that lost a
character — does not force the person to start again. It is still single-use: the
only path that reaches the consume has already verified, and a second request with
the same proof loses the race and is refused.

## Rate limits

| Surface | Default | Why |
| --- | --- | --- |
| Reading | 300/min per caller | `RATE_LIMIT_ANON`; also the backstop on every route |
| Sign-in and sign-in tokens | 5/min per **address** | `RATE_LIMIT_AUTH_ATTEMPTS` |
| Open challenges per address | 5 | A fixed cap; stops one address filling the table with unspent nonces |
| Per address, before the session is read | 1200/min | `RATE_LIMIT_IP_CEILING`; loose on purpose |

Beyond those, each endpoint is charged against a budget for its class of work —
engage, write, upload, donate, admin — so the cheapest route to abuse is not
budgeted like the busiest one. The full table is in
[api.md](api.md#rate-limits).

Forwarded headers are trusted **only** when `TRUSTED_PROXY_HOPS` is set to the
number of proxies you operate (`TRUST_PROXY_HEADERS=true` is the older spelling
and means one). The default of zero uses the TCP peer and no forwarded headers at
all, because honouring `X-Forwarded-For` with nothing in front to overwrite it
lets any client claim any address and walk past every per-address limit. When it
is trusted, the *rightmost* entry is used — everything to its left came from the
client.

---

## The sign-in message

There is no delivery step and nothing to configure for one. The challenge returns
a single string — the exact bytes the wallet must sign — and that is the whole
protocol:

```
Hustle On (https://hustleon.com)

Sign in with your Solana wallet.

Address: <your address>
Nonce: <a fresh nonce>
Issued At: <RFC 3339 timestamp>

This signature proves you control this wallet. It authorises no transfer, moves no funds and costs nothing.
```

Every interpolated part earns its place. The product name and the origin make the
signature meaningless anywhere else, so one harvested by a lookalike site cannot
be replayed here. The address binds the proof to the wallet that will own the
account. The nonce makes it single-use; the timestamp makes it expire.
`auth.SignInMessageTemplate` is the single definition of that text, and both the
challenge and the verification render it from the stored nonce — which is what
stops the two from drifting apart.

### Why there is no email

Sign-in used to depend on a third party's mail delivery: no API key, no way in; a
bounced message, no way in; and every attempt wrote a row whose only purpose was
to hold a secret in flight. A signature has none of that — the key never leaves
the wallet, and the only thing the server keeps is a public address that has
already proved itself. `users.email` survives as a nullable, non-unique contact
address — carried over for the accounts that predate migration 0013 — and it is
never a credential and never used to sign in. Nothing currently edits it; it is
kept so that an operator can recognise an account, not so that anybody signs in
with one.
See [ADR 0009](adr/0009-wallet-only-authentication.md).

### When a signature is refused

| What the caller sees | What it means |
| --- | --- |
| `That signature does not match the wallet.` (401) | The signed bytes are not the message the server rebuilt — a different wallet, a mangled paste, or text edited by a page. The nonce is not spent, so the same challenge can be tried again. |
| `That sign-in request has expired. Try again.` (400) | The nonce was already spent, or the challenge aged out. Ask for a fresh one. |
| `This account is suspended.` (403) | The signature is valid, but the account it belongs to is not allowed a session. |
| `Too many sign-in attempts. Wait a moment and try again.` (429) | The sign-in budget or the open-challenge cap. Check the rate limits above. |

---

## Reading the code

| Question | File |
| --- | --- |
| How is a sign-in challenge issued and verified? | `auth/signin.go` |
| How is a session created and revoked? | `auth/session.go` |
| How are cookies flagged? | `auth/cookie.go` |
| How is CSRF derived and checked? | `auth/csrf.go` |
| How is a wallet signature verified? | `auth/wallet.go` |
| Where does any of it touch Postgres? | `backend/internal/store/auth.go` |

The `auth` module owns the rules and knows nothing about Postgres; the backend
implements `auth.Store` over it. That split is what lets the rules be tested in
memory, with no database at all.
