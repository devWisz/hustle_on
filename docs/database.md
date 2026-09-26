# Database

Eight migrations, eleven tables of product state (plus `schema_migrations`). The
schema is small because the product is one path, and every table on it earns its
place.

```
users ──┬──< timelapses ──< timelapse_views
        │         │
        │         ├────────< donations >──── users (donor, nullable)
        │         ├────────< timelapse_notes ──< note_votes
        │         └────────< bookmarks
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
| `0005_engagement` | `bookmarks`, `timelapse_notes`, `note_votes` |
| `0006_search_indexes` | `pg_trgm` and the trigram indexes the feed search needs |
| `0007_maintenance` | Indexes for foreign keys that had none, `recount_totals()`, `purge_expired_auth()` |
| `0008_security_hardening` | The `sardhana_app` role and its grants, role-level timeouts, the append-only audit trigger |

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

**A note only attaches to work the public can see.**
```sql
CREATE TRIGGER timelapse_notes_published_only BEFORE INSERT ON timelapse_notes
```
Without it the notes endpoint would be a way to hang text off a draft its author
never published, or off something since taken down. The rule lives in the
database because "published" is checked in more than one place.

**A note's helpful count is derived, never asserted.**
```sql
CREATE TRIGGER note_votes_count AFTER INSERT OR DELETE ON note_votes
```
The count is incremented by the trigger that sees the vote row, so it cannot
disagree with the rows that justify it — no handler does the arithmetic.

**One vote per person per note.**
```sql
PRIMARY KEY (note_id, user_id)
```
The same shape as the view deduplication: the tally cannot be inflated by asking
twice, because the second ask is not a row.

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

**A bookmark is a join row, not a copy.** `bookmarks` stores the pair of account
and timelapse, so a corrected title or a takedown is reflected in every saved
list immediately. The list query reads the timelapse as it stands now and skips
anything no longer `published`.

**Search is indexed with trigrams.** The feed's search box matches a substring
anywhere in a title, summary or creator name, which a B-tree cannot serve — there
is no prefix to seek to. `0006_search_indexes` adds `pg_trgm` and a GIN index per
matched column, turning a sequential scan into an index lookup. `handle` is
`citext`, so its index is built over an explicit `::text` cast.

## The application role

The API does not connect as the database owner. Migrations need DDL and own the
schema; the API needs to read and write rows and nothing else. `0008` creates a
`sardhana_app` group role holding exactly the second set, and leaves the owner
for migrations.

Adopting it is two steps, done deliberately rather than as a side effect of
applying a migration:

```sql
-- 1. A login role that inherits the group, with its own password.
CREATE ROLE sardhana_api LOGIN PASSWORD 'generated-with-openssl-rand-base64-48'
    IN ROLE sardhana_app;
```

```bash
# 2. Point the API at it. The pooled endpoint, as before.
DATABASE_URL="postgres://sardhana_api:<password>@<pooler-host>/sardhana?sslmode=require"
```

The new role owns nothing, so it can drop nothing. What it specifically cannot
do, on top of the ordinary grants:

| Object | Withheld | Why |
| --- | --- | --- |
| `users`, `timelapses`, `donations` | `DELETE` | The API never deletes them; withdrawal is `status = 'removed'`. Revoking it means no bug can erase creator history. |
| `audit_log` | `UPDATE`, `DELETE` | See below. |
| `schema_migrations` | everything | An API that could edit the ledger could convince the next deployment a migration had run. |
| `recount_totals()`, `purge_expired_auth(interval)` | `EXECUTE` from `PUBLIC` | Maintenance is a deliberate operator action. |

Everything else keeps the write access it actually uses. Consuming a sign-in link
`UPDATE`s `magic_link_tokens`, consuming a wallet challenge `UPDATE`s
`wallet_challenges`, and withdrawing a "helpful" mark `DELETE`s from
`note_votes` — all three are narrow, intended writes, and revoking them would
break sign-in and voting rather than harden anything.

The role also carries session-level guards, set on the role because a pooled
endpoint does not reliably forward connection-string parameters to whichever
backend answers a connection:

```sql
ALTER ROLE sardhana_app SET statement_timeout = '10s';
ALTER ROLE sardhana_app SET lock_timeout = '5s';
ALTER ROLE sardhana_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE sardhana_app SET search_path = public, pg_catalog;
ALTER ROLE sardhana_app CONNECTION LIMIT 40;
```

A query that has gone wrong is cancelled instead of holding a connection; a
request waiting behind a migration gives up instead of hanging; a crashed request
that left a transaction open releases its locks. Pinning `search_path` also drops
the implicit `"$user"` schema, so a table created elsewhere cannot shadow one of
ours. None of these values is reachable by a correct query.

## The audit trail is append-only

`audit_log` accepts `INSERT` and nothing else. That is enforced twice:

- `UPDATE` and `DELETE` are revoked from `sardhana_app`, which stops the
  application.
- A `BEFORE UPDATE OR DELETE` trigger raises for **every** role, including the
  owner, which stops a person with a `psql` prompt.

The second is what makes the trail evidence rather than a log: a decision cannot
be edited away, and the only way to remove one is to disable the trigger first —
a statement recorded in the write-ahead log and visible to anyone reviewing it.
The trigger's hint spells out the procedure for the legitimate case:

```sql
ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only;
-- prune or repair, deliberately
ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only;
```

One consequence worth knowing before it surprises you: `audit_log.actor_id` is
`REFERENCES users(id) ON DELETE SET NULL`, and that `SET NULL` is itself an
`UPDATE`. So an account cannot be hard-deleted while the trigger is armed. With
it disarmed the delete succeeds and the account's decisions remain, attributed to
nobody, which is the record `0002` intended.

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

They also need to run as the **owner** — the role that `0008` recorded the
default privileges against. A `GRANT` recorded by one role does not apply to
tables a different role creates later, so a migration run as the application role
would produce tables the API could not read.

## Connection handling

The pool is deliberately conservative, because Neon bills by activity and scales
to zero when idle: a minimum of zero connections, a thirty-minute maximum
lifetime with five minutes of jitter — without the jitter every connection is
recycled at the same instant and shows up as a periodic stall — a five-minute
idle timeout and a one-minute health check. Cold starts are absorbed by the ping
at boot rather than by a user request.

Statements are executed in `QueryExecModeExec`. Statement caching interacts badly
with a pooler in transaction mode: a prepared statement may not exist on the
backend the pooler hands out next.

Every connection is tagged `application_name=sardhana-api`, so `pg_stat_activity`
answers "who is holding this lock" during an incident instead of leaving it to a
guess.

## Changing the schema

1. Write both `NNNN_name.up.sql` and `NNNN_name.down.sql`.
2. Apply, roll back, and apply again against a scratch database.
3. Update the store method and, if the field should be visible, the struct in
   `internal/domain`. A column with no field there is invisible to clients —
   which is the default, and usually the right one.
4. Update this file if you added a constraint worth knowing about.

Never edit a migration that has been applied anywhere. Add another.
