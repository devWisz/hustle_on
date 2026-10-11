# Authentication

Sardhana has two kinds of proof, and they answer different questions.

| Proof | Answers | Lives in |
| --- | --- | --- |
| **Email link** | Who is this account? | `auth/magiclink.go`, `auth/session.go` |
| **Wallet signature** | Which key should be paid? | `auth/wallet.go` |

They are deliberately separate. Signing in never touches a wallet, and proving
a wallet never signs you in. Someone who compromises an inbox cannot move
anybody's SOL, because the payout address is pinned to a key they do not hold.

There is no password anywhere in the system. There is no column for one, so
there is nothing to leak, reset, reuse across sites, or phish.

---

## Signing in

```
  POST /v1/auth/request-link          { email }
       │
       │  a 32-byte token is generated;
       │  only its SHA-256 digest is stored
       ▼
  email ── https://…/auth/verify?token=<secret> ──▶ the browser
       │
       ▼
  POST /v1/auth/verify                { token }
       │  digest looked up, marked consumed, session created
       ▼
  Set-Cookie: sardhana_session       (HttpOnly, Secure, SameSite=Lax)
  Set-Cookie: sardhana_session_csrf  (readable, by design)
```

### What each step guarantees

**The reply never varies.** `request-link` answers with the same message for an
unknown address, an existing account and a suspended one. Varying it would turn
the endpoint into a way to ask "does this person have an account here?"

**The token is stored as a digest.** The plaintext exists in exactly one place:
the recipient's inbox. A dump of `magic_link_tokens` grants nobody a session.

**The link works once.** `ConsumeMagicLink` marks the row used inside the same
`UPDATE` that reads it, with `consumed_at IS NULL` in the predicate. Two
concurrent requests race on the row lock and only the first gets a row back.

**Fifteen minutes.** Long enough to walk to another device, short enough that a
link sitting in a mail archive is worthless.

**The account is created on verification, not on request.** Asking for a link
for an address you do not control creates nothing, so an unverified address can
never occupy a handle.

**`next` must be a local path.** `SafeRedirectPath` rejects absolute URLs,
protocol-relative `//host` forms and anything with a newline in it. Without
that check, an emailed link is an open redirect that lands a freshly
authenticated visitor on somebody else's page.

---

## Staying signed in

The session cookie carries a random token. The database stores only its digest,
alongside the account, an expiry, and the address and user agent it was issued
to.

The cookie's flags are the security model, not decoration:

- **`HttpOnly`** — no script on the page can read it, so an XSS bug cannot
  exfiltrate a session.
- **`Secure`** — it never crosses a plaintext connection.
- **`SameSite=Lax`** — a cross-site `POST` cannot carry it, while a top-level
  navigation from the emailed link still works.
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
2. **Double-submit token.** `X-Sardhana-CSRF` must match an HMAC of this exact
   session's digest, keyed by `SESSION_SECRET`.

The CSRF cookie is intentionally *not* `HttpOnly` — the frontend has to read it
to echo it back. That is safe because it is derived from the session under a
server-side key: an attacker who can plant a cookie value still cannot produce
the matching token.

Both checks run in a single middleware in front of the whole API rather than in
each handler, so a new state-changing endpoint is covered by existing rather than
by remembering. A request with no session — requesting a sign-in link — is
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

**Sardhana never asks for a seed phrase or a private key** — not to sign in, not
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

Roles are granted in the database, deliberately. There is no endpoint that
promotes an account, so a bug in one cannot create an admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

---

## The profile step

Verifying an address creates the account: a handle derived from the local part of
the email, and a display name identical to it. That is enough to own a session
and not enough to be credited for one, so the address is verified first and the
name is asked for immediately afterwards, once (`users.onboarded_at`). Everything
in it is public and editable later; an account that has not been through it is
sent to `/welcome` before it can upload or open its dashboard, rather than
publishing work under a name nobody chose.

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
| Links per email | 5/hour | Stops mailbox flooding via our sender |
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

## Email delivery

Sign-in links leave the process through one of two mailers, chosen once at
startup by `buildMailer` in `backend/cmd/api/main.go`. Which one is in use is
logged on the first line of the API's output, because it is the single most
common thing to be wrong about when a link never arrives:

| Startup log line | What is happening |
| --- | --- |
| `RESEND_API_KEY is not set` | `LogMailer`. The link is printed to the API's own stdout and no email is sent. This is the default for local development and is not a fault. |
| `does not look like a Resend key` | A value is set but has no `re_` prefix — almost always another provider's key in the wrong variable. Every send will fail. |
| `sending through Resend` | `ResendMailer`, sending as the `from` address on that same line. |

Outside production the real send runs **alongside** the log, so a
misconfiguration is visible while developing rather than the first time someone
deploys. A failure there never fails the request — the link is already in the
log — but it is logged as
`Resend rejected the message; the link above was not delivered`, with the
provider's status and body. It is not swallowed.

### When a key is set and mail still does not arrive

1. **Read the error.** Resend returns the reason in the body and the API logs it
   verbatim.
2. **`403` almost always means the sender domain is not verified.** The domain in
   `EMAIL_FROM` has to be added and verified in the Resend dashboard, DNS records
   and all. A valid key with an unverified sender fails exactly like a bad key.
3. **`401` means the key itself.** Revoked, mistyped, or from a different Resend
   account than the domain.
4. **`422` means the payload.** Usually an `EMAIL_FROM` that is not a valid
   address or `Name <address>` pair.
5. **Nothing in the log at all** means the request never reached `StartLogin` —
   check the rate limits above before suspecting the mailer.

`config.Load` refuses to start a production process without `RESEND_API_KEY`, so
a deployment can never silently fall back to printing links.

---

## Reading the code

| Question | File |
| --- | --- |
| How is a link issued and consumed? | `auth/magiclink.go` |
| How is a session created and revoked? | `auth/session.go` |
| How are cookies flagged? | `auth/cookie.go` |
| How is CSRF derived and checked? | `auth/csrf.go` |
| How is a wallet signature verified? | `auth/wallet.go` |
| Where does any of it touch Postgres? | `backend/internal/store/auth.go` |

The `auth` module owns the rules and knows nothing about Postgres; the backend
implements `auth.Store` over it. That split is what lets the rules be tested in
memory, with no database at all.
