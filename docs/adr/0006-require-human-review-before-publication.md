# 6. Require human review before publication

**Status:** accepted

## Context

Hustle On's claim is that a published timelapse is a record of work that actually
happened. Anything that undermines that claim — a reposted screen recording,
a write-up describing work the video does not show, a link to somebody else's
repository — makes every other entry on the feed worth less.

The alternatives were: publish immediately and moderate on report, or automate
a check.

Publish-on-report puts the cost on viewers and only acts after the damage. The
things worth catching here are also exactly the things automation is worst at:
whether a write-up honestly describes a session is a judgement, not a
classifier.

## Decision

Nothing reaches the public feed without a person approving it. `published` is
written by exactly one statement in the codebase, behind the admin role.

A decline requires a written reason of at least ten characters, enforced by the
API and again by a database `CHECK`. The reason is shown to the creator on their
dashboard and stripped from every public payload. Resubmitting clears the
previous decision.

## Consequences

The feed is slower to fill and does not scale without reviewers. That is
accepted: a small honest feed is the product, and a large unchecked one is not.

An empty feed on a fresh install is the system working, which is worth saying
out loud in the documentation, because it looks like a bug.

Every creator gets an answer. A queue that silently swallows submissions would
be worse than rejecting them, so the rejection path carries as much design
attention as the approval path.

Review is a bottleneck with a person in it. If the queue outgrows the reviewers,
the answer is more reviewers or a narrower submission policy — not an automatic
approval path, which would quietly reverse this decision.
