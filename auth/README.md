# auth

Authentication primitives for Hustle On, kept in a separate Go module so the
rules live in one auditable place and the API server cannot accidentally
reimplement them.

The module has **no third-party dependencies** — only the standard library.
Storage is an interface (`Store`) that the backend satisfies over Postgres, and
password hashing is an interface (`PasswordHasher`) that the backend satisfies
with Argon2id; nothing here knows about HTTP routing. There is no mailer and no
delivery step: the sign-in message the wallet must sign goes straight back to the
caller, and email + password sends nothing either.

## What it provides

| File | Responsibility |
| ---- | -------------- |
| `token.go`     | Random token generation, SHA-256 digests, constant-time comparison |
| `signin.go`    | Issue a sign-in nonce and verify the wallet signature that spends it |
| `password.go`  | Password, name and email rules; sign-up, login and password change |
| `password_test.go` | Those rules, table-driven, against an in-memory store and hasher |
| `session.go`   | Create, look up, refresh and revoke sessions |
| `cookie.go`    | Cookie construction with the hardened default flags |
| `csrf.go`      | Double-submit token derived from the session, HMAC bound |
| `wallet.go`    | ed25519 verification of Solana wallet ownership proofs |
| `store.go`     | The `Store` interface the backend implements, and the `User` the rules need |

## Model

There are two ways in, and either creates an ordinary account.

**Email and password.** `SignUp` validates the name, address and password, hashes
the password, derives a handle from the name, and creates the account with
`onboarded_at` already set — the name is real, so there is no profile step to
send anyone to. `LogIn` normalises the address, looks the account up by it and
verifies the password. Every refusal — a wrong password, an unknown address, a
malformed address, an account that has only ever used a wallet — is the one
`ErrBadCredentials`, and when the address is unknown the service still runs a
verification against a decoy hash so the response time says nothing either. There
is no reset path, because nothing is emailed: `SetPassword` changes the password
for a signed-in account, requiring the current one when the account has one.

**A Solana wallet signature.** A login is:

1. The visitor asks for a challenge naming a Solana address.
2. A nonce is generated and stored against that address with a short expiry, and
   the exact text to sign is returned. Nothing is delivered anywhere.
3. The wallet signs it. The signature is verified against the address *before*
   the nonce is spent, so a mangled signature does not burn the challenge. The
   first address to do this gets an account; there is no separate sign-up.
4. A session token is issued in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.

Enumeration is not possible from the outside: the challenge looks up no account
and answers the same way whether the address is already known or has never been
seen.

For a wallet account, the wallet is the identity. Signing in proves control of the
address that owns the account; recording a payout address is a second proof over a
different server-issued nonce, so pasting somebody else's address proves nothing.

The sign-in signature and the payout proof answer different questions. One
establishes who is asking; the other fixes where money goes. The payout address
is pinned to a key, so claiming one already held elsewhere is a conflict rather
than a transfer.

### The hashing split

`auth` stays standard-library-only, so it does not implement Argon2id. The rules
about what a password may be are policy and live here (`password.go`); the
arithmetic sits behind the `PasswordHasher` interface and is supplied by the
backend (`backend/internal/password`). That is the same split as `Store`: the
module owns the rules, the backend owns the dependency. Verification reads the
parameters back out of the stored hash, so the cost can be raised later without
invalidating a single existing password.

## Testing

The rules are tested against an in-memory `Store` and a stub `PasswordHasher`, so
the whole module runs with no database and no Argon2id cost:

```bash
go test ./... -race
```

Keep it that way. These are exactly the rules you want covered by tests that
always run, everywhere, with no setup.

## Further reading

`docs/auth.md` documents the flows end to end, including what each step
guarantees and why.
