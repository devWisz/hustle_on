# 4. Ship the admin console as a separate application

**Status:** accepted

## Context

Moderation needs to hide content, remove it, and suspend accounts. The obvious
approach is a role-gated section of the public application. That ships
moderation code to every visitor's browser and puts it one routing mistake away
from being reachable.

## Decision

The admin console is a separate Next.js application on its own port and origin,
with its own bundle and a stricter Content-Security-Policy. It shares the
session cookie, and every route it calls is behind a role check in the API.

## Consequences

Accepted: some duplication — an API client, a few primitives, the token
stylesheet. The design tokens are copied rather than shared through a package,
which means a token change is a two-file edit.

Gained: no moderation code in a public bundle, a policy that can be tightened
without weighing public-site needs, and the option to put the console behind a
VPN or identity-aware proxy without touching the public site. The duplication
is small and static; the isolation is worth more than deduplicating it.
