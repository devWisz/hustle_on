-- Development reset: empties every table, and creates nothing.
--
-- This file used to seed an administrator. It does not any more, and that is a
-- deliberate improvement rather than an omission.
--
-- The seeded admin was an account nobody controlled: it had an address in a
-- .test domain, so it could only ever be signed into through a link printed to a
-- developer's own log. Now that sign-in is a wallet signature, seeding an admin
-- would mean shipping a wallet address into the repository, and a seeded admin
-- with no key is an account that can never be used and must be cleaned up by
-- hand afterwards.
--
-- Admin access comes from ADMIN_WALLETS instead. Sign in with your own wallet
-- once, and if its address is in that list the account is promoted at sign-in —
-- see docs/auth.md. There is no default credential here to leak or to forget.
--
-- Everything else is made by using the site: sign in, upload a real session from
-- /upload, and approve it from /admin/queue.
--
-- Safe to re-run: it empties every table. scripts/migrate.sh and cmd/migrate
-- both refuse to run it when APP_ENV=production.

BEGIN;

-- reports is named explicitly even though truncating timelapses would cascade to
-- it: a reset list that depends on a foreign key defined elsewhere goes stale the
-- next time a table is added.
TRUNCATE reports, note_votes, timelapse_notes, bookmarks, donations, timelapse_views,
         timelapses, audit_log, wallet_challenges, sessions, users
         RESTART IDENTITY CASCADE;

-- Nothing is inserted. A fresh database has no accounts, and the first one to
-- sign in with a wallet listed in ADMIN_WALLETS becomes the operator.

COMMIT;
