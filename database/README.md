# database

Migrations, seed data, and the notes that explain them.

```
migrations/   0001…0004, each with an .up.sql and a .down.sql
seeds/        dev_seed.sql — development only
```

The schema, the constraints and the reasoning behind them are documented in
[../docs/database.md](../docs/database.md). This directory holds the SQL itself.

```bash
make db-migrate    # apply pending
make db-status     # applied and pending
make db-rollback   # revert the most recent
make db-seed       # load development data
```

Migrations use `DATABASE_URL_DIRECT` — the unpooled endpoint — because they take
advisory locks and run DDL, neither of which survives a connection pooler.

Never edit a migration that has already been applied. Add another.
