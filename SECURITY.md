# Security

Hustle On moves real SOL between wallets, so reports are taken seriously.

**Do not open a public issue.** Use GitHub's private vulnerability reporting on
this repository. Include what you did, what happened, and what you expected; a
proof of concept against a local instance is ideal.

Please **do not test against the production deployment**, and never access,
modify or exfiltrate another person's data.

In scope: authentication and sessions, the CSRF and origin checks, the upload
path, sponsorship verification, authorisation, injection, and secrets exposure in
this repository or its history.

Out of scope: scanner output with no demonstrated impact, volume-only denial of
service, missing headers with no exploit path, and social engineering.

Only the latest commit on `main` is supported. The security model — no custody, no
email path, digest-only sessions, least-privilege database grants, an append-only
audit log — is documented in [docs/security.md](docs/security.md).
