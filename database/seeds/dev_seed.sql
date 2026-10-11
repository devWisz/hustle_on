-- Development seed: one administrator, and nothing else.
--
-- This file used to create eight invented creators and nine invented sessions
-- whose recordings shipped in frontend/public/demo. All of that is gone from the
-- product, and generating it here would only put it back: a seeded imitation of a
-- recorded session is exactly what the feed must never contain.
--
-- What the seed is for now is the one thing a fresh database cannot give you — an
-- account with the admin role, so the console is reachable at all. Everything
-- else is made by using the site: sign in, upload a real session from /upload,
-- and approve it from /admin/queue.
--
-- To make the account yours, sign in with your own address once and promote it:
--
--   UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
--   DELETE FROM users WHERE email = 'reviewer@hustleon.test';
--
-- Safe to re-run: it empties every table first. scripts/migrate.sh and
-- cmd/migrate both refuse to run it when APP_ENV=production.

BEGIN;

-- reports is named explicitly even though truncating timelapses would cascade to
-- it: a reset list that depends on a foreign key defined elsewhere goes stale the
-- next time a table is added.
TRUNCATE reports, note_votes, timelapse_notes, bookmarks, donations, timelapse_views,
         timelapses, audit_log, wallet_challenges, sessions, magic_link_tokens, users
         RESTART IDENTITY CASCADE;

-- The single admin account. The address is a .test domain so no real inbox is
-- involved, and locally the sign-in link prints to the API log rather than being
-- emailed.
INSERT INTO users (id, email, email_verified_at, handle, display_name, role, bio,
                   payout_address, payout_verified_at, created_at, last_seen_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'reviewer@hustleon.test', now(), 'reviewer',
   'Reviewer', 'admin',
   'Reads every submission before it reaches the feed.',
   NULL, NULL, now(), now());

COMMIT;
