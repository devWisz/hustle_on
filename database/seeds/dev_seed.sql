-- Development seed data. Never loaded against production: scripts/migrate.sh
-- refuses to run this when APP_ENV=production.
--
-- It creates one admin, two creators, and enough timelapses to exercise every
-- state the review queue can be in — published, waiting, and rejected — so the
-- queue and the feed both have something real to render on a fresh database.

BEGIN;

TRUNCATE donations, timelapse_views, timelapses, audit_log,
         wallet_challenges, sessions, magic_link_tokens, users RESTART IDENTITY CASCADE;

INSERT INTO users (id, email, email_verified_at, handle, display_name, role, bio,
                   payout_address, payout_verified_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@sardhana.test', now(),
   'admin', 'Sardhana Review', 'admin',
   'Reviews every submission before it reaches the feed.', NULL, NULL),

  ('00000000-0000-0000-0000-000000000002', 'mira@sardhana.test', now(),
   'mira', 'Mira Okafor', 'member',
   'Compiler work, mostly. I record the sessions because the interesting part is never in the commit.',
   '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', now()),

  ('00000000-0000-0000-0000-000000000003', 'dan@sardhana.test', now(),
   'dan', 'Dan Whitfield', 'member',
   'Building a synth in Rust in public.',
   '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', now());

INSERT INTO timelapses (id, user_id, slug, title, summary, github_url, x_url,
                        storage_key, playback_url, thumbnail_url,
                        duration_seconds, session_minutes, status,
                        submitted_at, published_at, view_count)
VALUES
  ('00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000002',
   'rewriting-the-borrow-checker-pass',
   'Rewriting the borrow-checker pass',
   'Six hours on the region inference pass. The old implementation walked the CFG twice and still got nested loops wrong, so I rewrote it as a single fixpoint over the dominator tree. Most of the session is me being wrong about where the back edge belongs; the last forty minutes are the fix and the test that proves it.',
   'https://github.com/mira/compiler', 'https://x.com/mira',
   'uploads/00000000-0000-0000-0000-000000000002/2026/09/seed01.mp4',
   'https://media.sardhana.test/seed01.mp4', NULL,
   48, 372, 'published', now() - interval '3 days', now() - interval '2 days', 214),

  ('00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-000000000003',
   'oscillator-bank-from-scratch',
   'An oscillator bank from scratch',
   'Started with nothing but a sample buffer and finished with eight voices of polyphony. The whole middle stretch is chasing an aliasing artefact that turned out to be an off-by-one in the wavetable index. Audio is muted here; the repo has the recordings.',
   'https://github.com/dan/synth', NULL,
   'uploads/00000000-0000-0000-0000-000000000003/2026/09/seed02.mp4',
   'https://media.sardhana.test/seed02.mp4', NULL,
   61, 245, 'published', now() - interval '2 days', now() - interval '1 day', 88),

  ('00000000-0000-0000-0000-0000000000a3',
   '00000000-0000-0000-0000-000000000002',
   'incremental-parsing-second-attempt',
   'Incremental parsing, second attempt',
   'Reworking the parser so an edit re-parses the changed subtree instead of the whole file. This session is the tree-diff groundwork: node identity, stable spans, and a test harness that replays real editing sessions against it.',
   'https://github.com/mira/compiler', NULL,
   'uploads/00000000-0000-0000-0000-000000000002/2026/09/seed03.mp4',
   NULL, NULL,
   55, 190, 'in_review', now() - interval '4 hours', NULL, 0);

INSERT INTO timelapses (user_id, slug, title, summary, storage_key,
                        duration_seconds, session_minutes, status,
                        submitted_at, review_note, reviewed_by, reviewed_at)
VALUES
  ('00000000-0000-0000-0000-000000000003',
   'a-rejected-submission',
   'A rejected submission',
   'This one exists so the dashboard has a rejection to render. The write-up does not describe any actual work, which is the reason it was declined.',
   'uploads/00000000-0000-0000-0000-000000000003/2026/09/seed04.mp4',
   30, 60, 'rejected', now() - interval '5 days',
   'The write-up does not say what was built. Add a description of the work and resubmit.',
   '00000000-0000-0000-0000-000000000001', now() - interval '4 days');

-- One confirmed donation, so the totals on the feed are not all zero.
INSERT INTO donations (timelapse_id, creator_id, donor_id, donor_address, payout_address,
                       amount_lamports, message, signature, cluster, slot,
                       status, confirmed_at)
VALUES
  ('00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000003',
   '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
   '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
   250000000, 'The fixpoint rewrite was worth watching.',
   'seedseedseedseedseedseedseedseedseedseedseedseedseedseedseedseed1234',
   'devnet', 301994112, 'confirmed', now() - interval '1 day');

-- Bring the denormalised counters in line with the rows above.
UPDATE timelapses SET donation_count = 1, donation_total_lamports = 250000000
 WHERE id = '00000000-0000-0000-0000-0000000000a1';

UPDATE users u SET timelapse_count = (
    SELECT count(*) FROM timelapses t
     WHERE t.user_id = u.id AND t.status = 'published');

UPDATE users SET donation_count = 1, donation_total_lamports = 250000000
 WHERE id = '00000000-0000-0000-0000-000000000002';

COMMIT;
