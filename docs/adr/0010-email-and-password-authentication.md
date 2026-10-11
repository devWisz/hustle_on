# 10. Email and password alongside wallet sign-in

**Status:** accepted
**Amends:** [0009](0009-wallet-only-authentication.md)

## Context

[0009](0009-wallet-only-authentication.md) made an ed25519 wallet signature the
only way in. The reasoning held for the people the product was built around:
they hold a Solana key because they are paid in SOL, so proving a wallet was
proving the one thing the product actually used. It also removed mail delivery
from the critical path entirely — no API key, no way in; a bounced message, no
way in — and with it the last reason to hold a credential that can be reused
across sites.

Two problems remained, and time made both harder to defend. Most people who
arrive at a sign-up form expect to type an email address and a password, and
"install a wallet extension first" is a step in front of an account that does not
need one yet. And a wallet was never actually required to upload, be reviewed or
be sponsored; it is required to *receive money*. Making it the price of an
account asked for more proof than the account needed.

The mail path could not simply be restored. It was removed because it made a
third party a precondition of signing in, and bringing it back for a reset link
would reintroduce exactly the dependency this project had decided against.

## Decision

Email + password becomes a second way in, alongside wallet sign-in rather than
instead of it. `POST /v1/auth/signup` takes a name, an email address and a
password, creates the account and signs it in; `POST /v1/auth/login` signs an
existing account in. Both issue the same session as a verified signature, and
either kind of account can upload, be reviewed and be sponsored.

Passwords are hashed with Argon2id (`m=64 MiB, t=3, p=1`, a random 16-byte salt
per password), stored in the PHC string that carries its own parameters, so the
cost can be raised later without invalidating existing passwords. The rules about
what a password may be are in the `auth` module; the arithmetic is in
`backend/internal/password`, behind an interface, because `auth` depends only on
the standard library.

An email address identifies exactly one account. `0014_email_password` adds
`users.password_hash` and a partial unique index on `users (email) WHERE email IS
NOT NULL`, so wallet-only accounts keep it NULL, plus two `CHECK` constraints:
nobody can be left with no way in, and a password always has an address to be
looked up by.

An email sign-up derives its handle from the name supplied and is onboarded
immediately; a wallet sign-in, which knows nothing about the person, keeps its
generated placeholder handle and the `/welcome` step.

**Nothing is emailed.** There is no verification link, because the address is not
proven, and no reset link, because there is no mailer. A forgotten password can
be changed while signed in, or set by an operator with `backend/cmd/setpassword`
from the machine holding the database.

## Consequences

Gained: the way in that most people expect, with no wallet extension and no mail
delivery in the path; a wallet required only where it is genuinely needed — to
receive money; and an operator account that can be created without a Solana
keypair.

Accepted: there is now a password store to protect. It is Argon2id-hashed, salted
per row and never selected onto a wire type, but a dump of `users.password_hash`
is an offline guessing target, and the project has taken on the credential
problems 0009 was glad to be rid of — reuse, phishing, and a sign-in form whose
refusals must stay indistinguishable. There is no reset link, so a forgotten
password is an operator action rather than a self-service one. 0009's wallet-only
design still stands for the wallet path; its claim that nothing but a signature
can authenticate an account no longer holds.
