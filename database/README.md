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

## Maintenance

```sql
SELECT recount_totals();            -- rebuild every cached counter from source rows
SELECT * FROM purge_expired_auth(); -- delete auth rows expired over 30 days ago
```

The API runs `purge_expired_auth()` once at start and then daily.
`recount_totals()` is the repair tool for when counters drift, for example after
editing rows by hand.

## Seed data

The seed mirrors the demo library the frontend ships with: one reviewer, eight
creators, six published sessions that play the recordings in
`frontend/public/demo`, two waiting for review, one sent back with a note, and
the sponsorships, notes, bookmarks and audit entries that go with them. It is
generated so the Solana addresses and signatures have valid shapes.
