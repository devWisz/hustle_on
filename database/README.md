# Database

Neon serverless Postgres. The Go API is the only process that writes here;
the frontends never hold a connection string.

## Connection strings

Neon gives two endpoints and they are not interchangeable:

- `DATABASE_URL` — the **pooled** endpoint (`-pooler` in the host). Used by the
  API, which opens short-lived connections from many concurrent requests.
- `DATABASE_URL_DIRECT` — the **unpooled** endpoint. Used by migrations, which
  need session-level features such as advisory locks and `CREATE TYPE`.

## Migrations

Plain SQL, applied in filename order, tracked in `schema_migrations`.

```bash
make db-migrate        # apply everything pending
make db-rollback       # revert the newest applied migration
make db-seed           # development fixtures (refuses to run on production)
```

Rules for new migrations:

1. Create both `NNNN_name.up.sql` and `NNNN_name.down.sql`. A migration without
   a tested down file is not finished.
2. Never edit a migration that has been applied anywhere but your own branch —
   add a new one.
3. Deploy in two steps for breaking changes: add the new column, backfill and
   ship code that writes both, then drop the old column in a later release.
4. Index creation on a large table uses `CREATE INDEX CONCURRENTLY` in its own
   migration file, since it cannot run inside a transaction.

## Branch-per-environment

Neon branching gives every environment and pull request a copy-on-write database.

```bash
neon branches create --name pr-142 --parent main
neon connection-string pr-142
```

Preview branches are created in CI and deleted when the pull request closes.
Production data never leaves the production branch; use a schema-only branch
when you need realistic structure without real user rows.

## Schema map

| Area       | Tables |
| ---------- | ------ |
| Identity   | `users`, `profiles`, `social_links`, `wallets`, `follows` |
| Auth       | `magic_link_tokens`, `sessions`, `wallet_challenges`, `audit_log` |
| Content    | `videos`, `tags`, `video_tags`, `video_views` |
| Discussion | `comments`, `comment_likes` |
| Money      | `onchain_transactions`, `sponsorships` |
| Hiring     | `jobs`, `job_applications`, `engagements`, `engagement_milestones` |
| Trust      | `reports`, `notifications` |

Counter columns (`follower_count`, `comment_count`, `sponsor_total_lamports`)
are denormalised for read speed and updated inside the same transaction as the
row they count. `database/queries/reconcile.sql` recomputes them if they ever drift.
