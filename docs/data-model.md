# Data model

Neon Postgres. Schema in `database/migrations`, applied in filename order.

## Areas

**Identity** — `users` holds the account: email, handle, role, status.
`profiles` is a strict one-to-one holding everything public and editable, so a
profile read never selects columns an authorisation check depends on.
`social_links` and `wallets` hang off the user; `follows` is the social graph.

**Auth** — `magic_link_tokens` and `sessions` store digests only.
`wallet_challenges` holds nonces awaiting a signature. `audit_log` is
append-only and records anything a human did that affected another account.

**Content** — `videos` carries the lifecycle (`draft` → `uploaded` →
`processing` → `published`, plus `failed` and `removed`) and its own counters.
`tags` and `video_tags` are many-to-many. `video_views` records coarse views.

**Discussion** — `comments` is one level of nesting with soft deletion, so
replies under a removed parent stay readable. `comment_likes` is the join.

**Money** — `onchain_transactions` is the verified ledger, unique on
`signature`. `sponsorships` is the platform's view, referencing a transaction
once one exists.

**Hiring** — `jobs`, `job_applications`, `engagements`,
`engagement_milestones`. An engagement records the escrow PDA; balances live on
chain.

**Trust** — `reports` with a partial unique index that allows one open report
per person per subject. `notifications` for in-app activity.

## Invariants

**A user always has a profile.** Both rows are inserted in one transaction in
`CreateUser`.

**A wallet belongs to one account.** `wallets.address` is globally unique, and
a partial unique index allows exactly one primary wallet per user.

**A signature is used once.** `onchain_transactions.signature` is unique, so a
transaction cannot be presented for two sponsorships.

**Counters move with their cause.** `comment_count`, `follower_count`,
`video_count`, `sponsor_total_lamports` are denormalised for read speed and
updated in the same transaction as the row they count.
`database/queries/reconcile.sql` recomputes them all if they ever drift.

**Money is never negative and never floating point.** Amounts are `bigint`
lamports with `CHECK (amount > 0)`; counters use `GREATEST(x - 1, 0)` on
decrement.

**Deletion is soft where history matters.** Removing a video sets
`status = 'removed'` so sponsorships that reference it keep their meaning.

## Indexing

The feed is served by a partial index on `published_at DESC` restricted to
published public rows, matched by keyset pagination — `WHERE published_at < $1`
rather than `OFFSET`, so deep pages stay cheap and no row is skipped when
something is published mid-scroll.

Trigram indexes back handle and title search. GIN indexes back the `skills`
array filters. Queue and status indexes are partial, covering only the rows
that are actually queried.

## Types

Enums (`user_role`, `video_status`, `payment_status`, …) rather than free text,
so an invalid state is rejected by the database, not only by the application.
`citext` for email and handle makes case-insensitive uniqueness a property of
the column. Timestamps are `timestamptz` without exception.

## Migrations

Every migration ships with a tested `.down.sql`. Applied migrations are never
edited — a new one is added. Breaking changes go out in two releases: add and
backfill, then drop. Index creation on a large table uses
`CREATE INDEX CONCURRENTLY` in its own file, since it cannot run inside a
transaction.
