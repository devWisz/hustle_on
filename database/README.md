# database

Migrations, seed data, and the notes that explain them. The schema, its
constraints and the reasoning behind them are documented in
[../docs/database.md](../docs/database.md).

```
migrations/
  0001_foundation        users, roles, the updated_at trigger
  0002_auth              sign-in links, sessions, wallet challenges, audit log
  0003_timelapses        submissions and their review lifecycle, views
  0004_donations         sponsorships and their on-chain verification state
  0005_engagement        bookmarks, notes and helpful votes
  0006_search_indexes    trigram search on titles, summaries and people
  0007_maintenance       missing foreign-key indexes, recount_totals(), purge_expired_auth()
  0008_security_hardening the sardhana_app role and its grants, role timeouts,
                         the append-only audit trigger
  0009_purge_grant       lets the API call the purge function 0008 restricted
seeds/
  dev_seed.sql           development data; refused when APP_ENV=production
```

Each migration has an `.up.sql` and a `.down.sql`. Never edit one that has
been applied; add another.

## The workflow in the schema

A creator records a session and uploads it (`timelapses.status = 'draft'`, then
`'uploaded'`), submits it (`'in_review'`), and a reviewer either publishes it
(`'published'`) or sends it back with a note (`'rejected'`). Every decision is
written to `audit_log`. Viewers sponsor a published session through `donations`,
which stay `'pending'` or `'submitted'` until the transfer is read back from the
chain and marked `'confirmed'`.

## Commands

```bash
make db-migrate    # apply pending migrations
make db-status     # applied and pending
make db-rollback   # revert the most recent
make db-seed       # reload development data (empties every table first)
```

Migrations use `DATABASE_URL_DIRECT`, the unpooled endpoint, because they take
advisory locks and run DDL that a connection pooler does not carry across
statements. The API image also contains the tool, so the same migrations can
run from a deploy: `/app/migrate up`.

## Privileges

Migrations run as the owner. The API is meant to run as a different role that
inherits `sardhana_app`, which `0008` gives read/write access to every table and
then withholds the things the API does not do: `DELETE` on `users`, `timelapses`
and `donations`, any write to `schema_migrations`, and `UPDATE`/`DELETE` on
`audit_log`. The full list, and the two steps to adopt it, are in
[../docs/database.md](../docs/database.md#the-application-role).

## Maintenance

```sql
SELECT recount_totals();            -- rebuild every cached counter from source rows
SELECT * FROM purge_expired_auth(); -- delete auth rows expired over 30 days ago
```

The API calls `purge_expired_auth()` once at start and then daily, so it holds
`EXECUTE` on that one (`0009`). `recount_totals()` is the repair tool for when
counters drift, for example after editing rows by hand, and is deliberately left
to the owner — it rewrites every counter in the database, which is not something
a request-serving process should be able to do.

## The audit trail cannot be edited

`UPDATE` and `DELETE` on `audit_log` are refused by a trigger, for every role
including the owner. Removing a line means disabling the trigger first, which is
recorded in the write-ahead log. The procedure and its consequences are in
[../docs/database.md](../docs/database.md#the-audit-trail-is-append-only).

## Seed data

The seed creates one thing: an administrator, `reviewer@sardhana.test`.

It used to generate eight creators and nine sessions with recordings shipped in
`frontend/public/demo`. That is gone, deliberately. A seeded imitation of a
recorded session is the one thing this product must not display, and the review
queue it filled was a rehearsal of a workflow rather than the workflow. Sign in
as the administrator, upload a real session from `/upload`, and approve it from
`/admin/queue`.

To make that account yours, sign in with your own address once and then promote
it — roles are granted in the database on purpose, so no bug in an endpoint can
create one:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
DELETE FROM users WHERE email = 'reviewer@sardhana.test';
```
