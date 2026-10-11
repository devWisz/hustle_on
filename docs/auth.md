# Authentication

Two ways lead to the same kind of account:

| Way in | What it proves | Lives in |
| --- | --- | --- |
| **Email + password** | Something you know | `auth/password.go`, `backend/internal/password` |
| **Solana wallet signature** | A key you hold | `auth/signin.go`, `auth/session.go` |

Either one produces an ordinary account that can upload, be reviewed and be
sponsored. **A wallet is only required to receive money.** An email account can
do everything else, and links a payout wallet later from settings by the same
wallet-proof flow described below.

Wallet-only sign-in was a deliberate choice once — [ADR 0009](adr/0009-wallet-only-authentication.md)
records the reasoning — and email + password was added back alongside it, not in
place of it. [ADR 0010](adr/0010-email-and-password-authentication.md) records
why, and what it cost.

There is also a third signature, which is not a way in at all: the **payout
proof**. The two wallet signatures answer different questions.

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

## Passwords

Passwords are hashed with **Argon2id**, the current recommendation for new
passwords: memory-hard, so the cost of a guessing attack is dominated by RAM
rather than by raw compute, which is what makes GPUs and purpose-built crackers
bad at it. The parameters are `m=64 MiB, t=3, p=1`, and every password gets a
fresh random 16-byte salt. The stored value is a PHC string that carries its own
parameters and salt:

```
$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>
```

Verification reads the cost back out of the hash rather than from the current
constants, so the cost can be raised later without invalidating a single stored
password. Hashing lives in `backend/internal/password`, behind a `PasswordHasher`
interface defined in the `auth` module — `auth` depends only on the standard
library, so the arithmetic is left to a well-reviewed library while the rules
about what a password may be stay in `auth/password.go`.

**What a password may be** is stated as rules rather than a strength meter:

| Field | Rule |
| --- | --- |
| Password | At least 10 characters, at most 200 |
| Password | Not only whitespace, and not equal to the email address |
| Password | At least 4 distinct characters |
| Name | 1–60 characters, and at least one letter or digit |
| Email | At most 254 characters; trimmed, lowercased and parsed before use |

A failure names the field it is about, so a form can put the message beside the
input that caused it.

**There is no password reset.** Nothing is emailed — there is no verification
link and no reset link, because the mail path was removed deliberately — so a
forgotten password cannot be recovered by the person who forgot it. What is
possible is narrower: change it while signed in, or, if you have access to the
machine holding the database, set a new one with `backend/cmd/setpassword`,
which prints the generated password once. That is the whole recovery path, and
it is a small one.

---

## Signing in

### Email and password

```
  POST /v1/auth/signup   { name, email, password }   ← creates the account
  POST /v1/auth/login    { email, password }         ← signs an existing one in
       │  the address is parsed and normalised (trimmed, lowercased);
       │  the password is verified against the stored Argon2id hash
       ▼
  Set-Cookie: hustleon_session       (HttpOnly, Secure, SameSite=Lax)
  Set-Cookie: hustleon_session_csrf  (readable, by design)
```

Both endpoints end by issuing a session, exactly as a verified wallet signature
does. There is no verification step to pass first, because nothing is delivered
to prove the address. An account made this way is stamped onboarded at sign-up —
the handle is derived from the name that was just given — so it never sees the
`/welcome` profile step. See [The profile step](#the-profile-step).

### Solana wallet signature

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

### What the wallet steps guarantee

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

### What the password steps guarantee

**Refusals are indistinguishable.** A wrong password, an unknown address, a
malformed address and an account that has only ever used a wallet all return the
same `401` message. One error value (`auth.ErrBadCredentials`) stands for all of
them, because telling them apart is exactly what turns a login form into a
directory of who has an account here.

**Response time does not leak either.** When the address is unknown — or belongs
to an account with no password — the server still runs a real Argon2id
verification against a decoy hash before refusing, so "no such account" does not
come back faster than "wrong password".

**Nothing is emailed.** There is no verification link and no reset link. The
address is never proven, and a forgotten password cannot be reset by the person
who forgot it; [Passwords](#passwords) above says what is possible instead.

**A change requires the current password.** `POST /v1/me/password` needs the
session, and when the account already has a password it also needs that current
password. Without it, a session left open on a shared machine would be enough to
lock the owner out of their own account — which matters more here than usual,
because there is no reset link to fall back on. A successful change revokes the
account's other sessions.

**The handle comes from the name.** An email sign-up derives the handle from the
display name — "Ada Lovelace" becomes `ada_lovelace` — trying `_1`, `_2` and
`_3` on collision and falling back to a generated `hustler_…` handle after that.
Because the name is real, the account is stamped onboarded when it is created and
never sees `/welcome`. A wallet sign-in is the opposite: nothing is known about
the account, so it gets a placeholder handle and does go through the profile
step.

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

Separately, an **operator account** can be created with an email and password
from the machine holding the database:

```bash
cd backend && go run ./cmd/setpassword --email you@example.com --name "Your Name" --admin
```

It prints the generated password once, and running it again on the same address
sets a new one. The operator's own credentials live in the gitignored
`ADMIN-ACCESS.md`.

---

## The profile step

Only a wallet sign-in goes through it. That path creates the account before
anything is known about the person: a generated placeholder handle and a display
name identical to it. The handle is generated rather than asked for, because a
form between somebody and the account they have just proved they own is
ceremony, and the handle is public decoration that onboarding replaces a moment
later. That much is enough to own a session and not enough to be credited for
one, so the name is asked for immediately afterwards, once
(`users.onboarded_at`). Everything in it is public and editable later; an account
that has not been through it is sent to `/welcome` before it can upload or open
its dashboard, rather than publishing work under a name nobody chose.

An email sign-up does not see it at all. It already has a real name, so the
handle is derived from that name and `onboarded_at` is set in the same insert:
there is nothing left to ask, and no reason to make somebody fill in a form with
information the server already holds.

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
| Sign-in challenge | 20/min per **address** | `RATE_LIMIT_AUTH_ATTEMPTS`. This used to be 5 because every request sent an email; a signature sends nothing, and the token bucket hands out a quarter of the budget as a burst, so 5 meant one attempt and then a twelve-second wait |
| Email + password sign-up | 20/min per **address** | The same `auth` budget as asking for a challenge, because each request writes an account and does an expensive hash |
| Email + password sign-in | 10/min per **address** | The `verify` budget, half of `RATE_LIMIT_AUTH_ATTEMPTS`. This is the endpoint where guessing a password is the whole attack, so it is the tighter of the two |
| Password change | `RATE_LIMIT_WRITE` 60/min per caller | The `write` budget; it requires a session, so it is charged to the account rather than to an address |
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

### Why nothing is emailed

Sign-in used to depend on a third party's mail delivery: no API key, no way in; a
bounced message, no way in; and every attempt wrote a row whose only purpose was
to hold a secret in flight. The mailer and its templates were removed for that
reason, and adding email + password did not bring them back — there is still
nothing to deliver and nothing to configure for delivery. A signature proves a
key that never leaves the wallet; a password is checked against a stored hash.
Neither needs an inbox.

The honest cost is that a forgotten password cannot be reset. The address on a
password account is not proven, and there is no code that sends anything, so
there is no reset link to click. An account can change its password while signed
in — supplying the current one when it has one — and an operator with access to
the machine holding the database can set a new one with
`backend/cmd/setpassword`. `users.email` is now a real credential for the
accounts that have one: it is unique (through a partial unique index, so
wallet-only rows keep it NULL) and is what a password sign-in looks the account
up by.

See [ADR 0009](adr/0009-wallet-only-authentication.md) for why the mail path was
removed, and [ADR 0010](adr/0010-email-and-password-authentication.md) for why
passwords came back without it.

### When sign-in is refused

| What the caller sees | What it means |
| --- | --- |
| `That signature does not match the wallet.` (401) | The signed bytes are not the message the server rebuilt — a different wallet, a mangled paste, or text edited by a page. The nonce is not spent, so the same challenge can be tried again. |
| `That sign-in request has expired. Try again.` (400) | The nonce was already spent, or the challenge aged out. Ask for a fresh one. |
| `That email address and password do not match an account.` (401) | Password sign-in. A wrong password, an unknown address, a malformed address and an account that has only ever used a wallet all get this one answer, on purpose. |
| `An account already exists for that email address.` (409, with `fields.email`) | Sign-up with an address that already identifies an account. |
| A rule, with the field named (422) | Sign-up with a name, address or password that breaks one of the stated rules. |
| `This account is suspended.` (403) | The signature or the password was valid, but the account is not allowed a session. |
| `That is not your current password.` (422, with `fields.currentPassword`) | A password change on an account that has a password, where the current one did not match. |
| `Too many sign-in attempts. Wait a moment and try again.` (429) | The sign-in budget or the open-challenge cap. Check the rate limits above. |

---

## Reading the code

| Question | File |
| --- | --- |
| How is a sign-in challenge issued and verified? | `auth/signin.go` |
| What may a password, a name or an address be? | `auth/password.go` |
| How are passwords hashed and verified? | `backend/internal/password/argon2id.go` |
| How are sign-up, login and password change handled? | `backend/internal/server/password_handlers.go` |
| How is an operator password set from the command line? | `backend/cmd/setpassword/main.go` |
| How is a session created and revoked? | `auth/session.go` |
| How are cookies flagged? | `auth/cookie.go` |
| How is CSRF derived and checked? | `auth/csrf.go` |
| How is a wallet signature verified? | `auth/wallet.go` |
| Where does any of it touch Postgres? | `backend/internal/store/auth.go` |

The `auth` module owns the rules and knows nothing about Postgres; the backend
implements `auth.Store` over it. It is also standard-library-only, which is why
the arithmetic of Argon2id sits behind the `auth.PasswordHasher` interface and is
implemented in `backend/internal/password` rather than here. That split is what
lets the rules be tested in memory, with no database at all.
