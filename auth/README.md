# auth

Authentication primitives for Hustle On, kept in a separate Go module so the
rules live in one auditable place and the API server cannot accidentally
reimplement them.

The module has **no third-party dependencies** — only the standard library.
Storage is an interface (`Store`) that the backend satisfies over Postgres;
nothing here knows about HTTP routing. There is no mailer and no delivery step:
the sign-in message the wallet must sign goes straight back to the caller.

## What it provides

| File | Responsibility |
| ---- | -------------- |
| `token.go`     | Random token generation, SHA-256 digests, constant-time comparison |
| `signin.go`    | Issue a sign-in nonce and verify the wallet signature that spends it |
| `session.go`   | Create, look up, refresh and revoke sessions |
| `cookie.go`    | Cookie construction with the hardened default flags |
| `csrf.go`      | Double-submit token derived from the session, HMAC bound |
| `wallet.go`    | ed25519 verification of Solana wallet ownership proofs |
| `store.go`     | The `Store` interface the backend implements, and the `User` the rules need |

## Model

There are no passwords and no email. A login is:

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

The wallet is the identity. Signing in proves control of the address that owns
the account; recording a payout address is a second proof over a different
server-issued nonce, so pasting somebody else's address proves nothing.

The sign-in signature and the payout proof answer different questions. One
establishes who is asking; the other fixes where money goes. The payout address
is pinned to a key, so claiming one already held elsewhere is a conflict rather
than a transfer.

## Testing

The rules are tested against an in-memory `Store`, so the whole module runs with
no database:

```bash
go test ./... -race
```

Keep it that way. These are exactly the rules you want covered by tests that
always run, everywhere, with no setup.

## Further reading

`docs/auth.md` documents the flows end to end, including what each step
guarantees and why.
