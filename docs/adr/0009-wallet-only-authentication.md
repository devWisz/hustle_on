# 9. Sign in with a Solana wallet signature

**Status:** accepted; partly superseded by [0010](0010-email-and-password-authentication.md)
**Supersedes:** [0002](0002-passwordless-authentication.md)

## Context

[0002](0002-passwordless-authentication.md) removed passwords and made a
single-use emailed link the way in. It closed credential stuffing and cross-site
reuse, but it made a third party's mail delivery a precondition of signing in at
all: no API key, no way in; a bounced message, no way in. Every attempt also wrote
a row whose only purpose was to hold a secret in flight, and the account's
identity was an email address that had to be unique even though it was never a
credential.

The product is for people who already hold a Solana key — they are paid in SOL and
prove a payout address by signature. Asking them to prove an inbox instead was
proving something the product never used.

## Decision

Sign-in is an ed25519 signature. The browser asks for a challenge, the server
stores a short-lived nonce against the address and returns the exact text to sign,
and the wallet signs it. The server verifies the signature against the address
before spending the nonce, then finds the account or creates it. There is no
separate sign-up.

`users.wallet_address` is the identity (`0013_wallet_identity`), and it is unique.
`users.email` remains as optional contact information: nullable, not unique, and
never used to authenticate. The magic-link table, the mailers and the templates
are gone, and nothing is emailed for any purpose.

## Consequences

Gained: no third party in the sign-in path, nothing to deliver and nothing to
bounce, no in-flight secret table, and an identity that is the same thing the
product pays to. Enumeration is closed because the challenge looks up no account,
and proving control of a wallet is the same act as creating the account.

Accepted: losing the key means losing the account, and there is no recovery by
design. Signing in requires a wallet extension, which excludes anyone without one,
and it cannot be done on a device that does not hold the key. Every account that
predates `0013` has no wallet address and cannot sign in until one is linked —
`make preflight` fails while any such account exists.
