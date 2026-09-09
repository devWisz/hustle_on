# Database

Four migrations, five tables. The schema is small because the product is one
path, and every table on it earns its place.

```
users ──┬──< timelapses ──< timelapse_views
        │         │
        │         └────────< donations >──── users (donor, nullable)
        │
        ├──< sessions
        ├──< magic_link_tokens
        ├──< wallet_challenges
        └──< audit_log
```

| Migration | Adds |
| --- | --- |
| `0001_foundation` | `citext`, the `set_updated_at` trigger, `users` |
| `0002_auth` | `magic_link_tokens`, `sessions`, `wallet_challenges`, `audit_log` |
| `0003_timelapses` | `timelapses`, `timelapse_views` |
| `0004_donations` | `donations` |

Each has a matching `.down.sql`. Both directions are exercised before a
migration is committed.

## Rules the database enforces itself

Constraints are not documentation. Each of these makes an invalid state
impossible rather than merely discouraged, so a bug in a handler — or a write
that never goes through the API — cannot produce one.

**A published timelapse is watchable.**
```sql
CHECK (status <> 'published' OR (published_at IS NOT NULL AND playback_url IS NOT NULL))
```
No code path can produce a feed entry that renders as a broken player.

**A rejection carries a reason.**
```sql
CHECK (status <> 'rejected' OR (reviewed_at IS NOT NULL AND review_note IS NOT NULL))
```
"No" without one is not something a creator can act on.

**A payout address comes with its proof.**
```sql
CHECK ((payout_address IS NULL) = (payout_verified_at IS NULL))
```
An address is never on file without the signature that established it. The
column is also `UNIQUE`, so one address belongs to one account.

**Links point where they claim to.**
```sql
CHECK (github_url ~ '^https://github\.com/[A-Za-z0-9._/-]{1,180}$')
```
These are rendered as links on public pages.

**Money is counted once, and only with evidence.**
```sql
signature text UNIQUE
CHECK (status <> 'confirmed' OR (signature IS NOT NULL AND confirmed_at IS NOT NULL))
CHECK (donor_id IS NULL OR donor_id <> creator_id)
```
The unique signature is what stops one transaction being credited twice, at the
level below the code that tries.

## Design notes

**One `users` table, not `users` plus `profiles`.** At this scale a profile
table would share the same primary key and be joined on every single read. The
six profile columns live on the account row.

**Counters are denormalised** (`timelapse_count`, `donation_count`,
`donation_total_lamports`) and maintained by the API inside the same transaction
as the write that changes them. A profile card should not have to aggregate the
donations table. `seeds/dev_seed.sql` recomputes them from the rows it inserts,
which doubles as a check that the arithmetic in the store matches.

**Indexes are partial where the query is.** The feed indexes only rows that can
appear in it; the review queue only rows waiting on a decision:

```sql
CREATE INDEX timelapses_feed_idx   ON timelapses (published_at DESC) WHERE status = 'published';
CREATE INDEX timelapses_review_idx ON timelapses (submitted_at)      WHERE status = 'in_review';
```

**Views are deduplicated by index, not by code.** Two partial unique indexes on
`timelapse_views` — one for signed-in viewers, one for fingerprints — mean a
refresh loop inserts nothing, and the counter is only touched when the insert
was genuinely new.

**Rows are not deleted.** Withdrawal sets `status = 'removed'`, because
donations reference the row and a supporter's record must not vanish.

**`payout_address` is copied onto each donation** rather than joined, so a
creator changing their wallet later cannot retroactively change where an earlier
donation was supposed to land.

**Tokens are stored as digests.** `magic_link_tokens.token_hash` and
`sessions.token_hash` are SHA-256. A dump of either table grants nobody a
session.

## Running migrations

```bash
make db-migrate     # apply pending
make db-status      # applied and pending
make db-rollback    # revert the most recent
make db-seed        # development data; refuses when APP_ENV=production
```

`scripts/migrate.sh` uses `psql` when it is installed and falls back to
`backend/cmd/migrate` when it is not. Each migration and its bookkeeping row
commit together, so a failure leaves neither a half-applied schema nor a false
record of success.

Migrations need `DATABASE_URL_DIRECT`, the unpooled endpoint: they take advisory
locks and run DDL, neither of which survives a connection pooler.

## Changing the schema

1. Write both `NNNN_name.up.sql` and `NNNN_name.down.sql`.
2. Apply, roll back, and apply again against a scratch database.
3. Update the store method and, if the field should be visible, the struct in
   `internal/domain`. A column with no field there is invisible to clients —
   which is the default, and usually the right one.
4. Update this file if you added a constraint worth knowing about.

Never edit a migration that has been applied anywhere. Add another.
