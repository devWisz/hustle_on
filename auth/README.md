# auth

Authentication primitives for Sardhana, kept in a separate Go module so the
rules live in one auditable place and the API server cannot accidentally
reimplement them.

The module has **no third-party dependencies** — only the standard library.
Storage and email delivery are interfaces (`Store`, `Mailer`) that the backend
satisfies; nothing here knows about Postgres or HTTP routing.

## What it provides

| File | Responsibility |
| ---- | -------------- |
| `token.go`     | Random token generation, SHA-256 digests, constant-time comparison |
| `magiclink.go` | Issue and consume single-use email login links |
| `session.go`   | Create, look up, refresh and revoke sessions |
| `cookie.go`    | Cookie construction with the hardened default flags |
| `csrf.go`      | Double-submit token derived from the session, HMAC bound |
| `wallet.go`    | ed25519 verification of Solana wallet ownership proofs |
| `resend.go`    | Resend transactional email client |

## Model

There are no passwords. A login is:

1. The visitor submits an email address.
2. A 256-bit token is generated. The **digest** is stored; the plaintext is
   only ever in the email.
3. The link is opened within the TTL, the token is consumed atomically, and a
   session token is issued in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.

Enumeration is not possible from the outside: requesting a link for an unknown
address returns the same response and takes the same path as a known one.

Wallets are separate from identity. Connecting a wallet requires signing a
server-issued nonce, so pasting somebody else's address proves nothing.
