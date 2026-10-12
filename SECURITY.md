# Security

Hustle On moves real SOL between wallets, so security reports are taken
seriously and answered quickly.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository, which keeps the report visible only to the maintainers until
a fix ships.

Please include what you did, what happened, and what you expected. A proof of
concept against a local instance is ideal; **do not test against the production
deployment**, and do not access, modify or exfiltrate another person's data.

## What is in scope

- Authentication, session handling, and the CSRF and origin checks
- The upload path: presigned URLs, content-type allowlists, storage keys
- Sponsorship verification — anything that could credit SOL that did not move
- Authorisation: reaching an admin capability, or another member's data
- SQL injection, XSS, SSRF, and request smuggling through the proxy
- Secrets exposure in this repository or its history

## What is out of scope

- Reports from automated scanners with no demonstrated impact
- Denial of service through volume alone
- Missing headers with no exploit path
- Social engineering of maintainers or users
- Anything requiring a compromised device or browser extension

## How the system is built

The decisions below are load-bearing; a report that assumes the opposite is
usually reporting intended behaviour.

- **No custody.** The API never holds a key that can move anyone's money. It
  verifies a sponsorship transaction that has already settled on-chain.
- **No email.** There is no mail path in the code, so there is no reset link to
  intercept and no mail provider to compromise. A lost password is reset by an
  operator with database access.
- **Sessions are server-side rows**, stored as digests, in `HttpOnly`, `Secure`,
  `SameSite=Lax` cookies. A stolen cookie is revocable; a forged one is not
  possible without the secret.
- **CSRF is enforced on every state-changing request** with a double-submit
  token, on top of an origin allowlist.
- **The database role is least-privilege.** The API cannot delete accounts,
  sessions or donations, cannot touch the audit log, and cannot read the
  migration ledger. Those limits are Postgres grants, not application code.
- **The audit log is append-only**, enforced by a database trigger.
- **Every endpoint has a rate-limit budget**, plus a per-address ceiling.

## Supported versions

Only the latest commit on `main` is supported. There are no maintained release
branches.
