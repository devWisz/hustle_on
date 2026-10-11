# 2. Passwordless authentication with email magic links

**Status:** superseded by [0009](0009-wallet-only-authentication.md)

## Context

The platform holds people's earnings. Account takeover is the highest-impact
attack against it. Passwords bring credential stuffing, reuse across sites,
phishing, a reset flow that is itself an attack surface, and a hash database
that is permanently valuable to an attacker.

## Decision

There are no passwords. Signing in emails a single-use link containing a
256-bit token; only its SHA-256 digest is stored, with a fifteen-minute expiry.
A successful verification issues an opaque session token, stored as a digest
and delivered in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.

Wallet signatures are used for proving control of an address, not for
authentication. Wallet-only login would make losing a key equal losing the
account, and would exclude anyone browsing without a wallet extension.

## Consequences

Accepted: sign-in depends on email deliverability, and a compromised inbox is a
compromised account — the same as any password reset flow, without the extra
password. Sign-in on a device without inbox access is inconvenient.

Gained: no password hashes to breach, no reset flow to abuse, no credential
stuffing, and no cross-site reuse. Enumeration is closed because the response is
identical for known and unknown addresses.
