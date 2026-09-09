# 5. Fold the admin console into the web app

**Status:** accepted
**Supersedes:** [0004](0004-separate-admin-application.md)

## Context

[0004](0004-separate-admin-application.md) put the operator console in its own
Next.js application, on the grounds that a cross-site scripting bug in the
public site should not be able to reach a moderation surface.

That reasoning was sound for the product as it stood then, which had a
moderation queue, report handling, account suspension, payout inspection and a
hiring console. The product has since narrowed to one operator action:
approving or declining a timelapse before it reaches the feed.

The separation cost a second application to build, deploy, authenticate and
keep visually in step. For a review queue and two buttons, that price stopped
being worth paying.

## Decision

The review queue is a role-gated route in the public application, at `/admin`.

The separation that actually matters is kept in the API, which is where it was
always enforced: every admin endpoint goes through `requireAdmin` against the
session record, and every decision writes an `audit_log` row. Nothing about
authorisation depended on the second application.

To a signed-in member, `/admin` returns **404** rather than 403, so the page's
existence is not confirmed to accounts that cannot use it.

## Consequences

One application to run, build and deploy. The review queue inherits the design
system rather than reimplementing it, and a reviewer is signed in once rather
than twice.

The XSS concern from 0004 is genuinely reduced rather than eliminated: an
attacker with script execution in a reviewer's session can now reach the review
endpoints. That is mitigated by the audit log making any such action visible
after the fact, and by the blast radius being small — the worst outcome is a
wrongly published or wrongly declined timelapse, both reversible, neither
involving money.

If the operator surface grows back — account suspension, payout controls,
anything irreversible — this decision should be revisited, and 0004's reasoning
will apply again.
