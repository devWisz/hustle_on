-- Development seed. Refused when APP_ENV=production.
--
-- Mirrors the demo library the frontend ships with: one reviewer, eight
-- creators, six published sessions with the demo recordings in
-- frontend/public/demo, two waiting for review and one sent back, plus the
-- sponsorships, notes and audit trail that go with them.
--
-- Safe to re-run: it empties every table first.

BEGIN;

TRUNCATE note_votes, timelapse_notes, bookmarks, donations, timelapse_views,
         timelapses, audit_log, wallet_challenges, sessions, magic_link_tokens, users
         RESTART IDENTITY CASCADE;
-- Accounts ------------------------------------------------------------------
INSERT INTO users (id, email, email_verified_at, handle, display_name, role, bio,
                   payout_address, payout_verified_at, created_at, last_seen_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'reviewer@sardhana.test', now(), 'reviewer', 'Rae Osei', 'admin', 'Reads every submission before it reaches the feed.',
   NULL, NULL, now() - interval '400 days', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-000000000002', 'mira@sardhana.test', now(), 'mira', 'Mira Okonkwo', 'member', 'Compiler internals, mostly lifetimes. I record the sessions where I am wrong for longer than I am right.',
   'MASi45ub7Qe4ZE36UT5G6cU4ud8Fhhe4deS4F3cw9KTA', now(), now() - interval '360 days', now() - interval '6 hours'),
  ('00000000-0000-0000-0000-000000000003', 'theo@sardhana.test', now(), 'theo', 'Theo Lindqvist', 'member', 'Payments infrastructure. Ledgers that balance, or an explanation of why they did not.',
   'b8dLcukC7edhDQ7cn5d4gEYkbUrMWeWQLGsCmrG6dLaY', now(), now() - interval '320 days', now() - interval '9 hours'),
  ('00000000-0000-0000-0000-000000000004', 'ana@sardhana.test', now(), 'ana', 'Ana Ruiz', 'member', 'Databases and the queries people regret. Four hours of query plans, condensed.',
   'yNoVKf58ZTBqNAYT3j5qcdsyuMNmPfYetW5v6JXmj54o', now(), now() - interval '280 days', now() - interval '12 hours'),
  ('00000000-0000-0000-0000-000000000005', 'kenji@sardhana.test', now(), 'kenji', 'Kenji Watanabe', 'member', 'Firmware and board bring-up. Everything here was recorded at a bench.',
   'mLidkuVKnRyjP2WPBg8Y4ErK9pGSSxY6BVScJy9uUxcJ', now(), now() - interval '240 days', now() - interval '15 hours'),
  ('00000000-0000-0000-0000-000000000006', 'priya@sardhana.test', now(), 'priya', 'Priya Raman', 'member', 'Interface work on products that are already shipped and already dense.',
   'nTPkyRFA6CAFjF1YveCHK1ATbQgdM9mwZgikp4Wzxrxk', now(), now() - interval '200 days', now() - interval '18 hours'),
  ('00000000-0000-0000-0000-000000000007', 'dan@sardhana.test', now(), 'dan', 'Dan Whitfield', 'member', 'Platform migrations, written down so the next person does not have to guess.',
   'tcSSSS7XhS4D5EVB8Nf471dAb7Qg25xEgRAhHPfQX88w', now(), now() - interval '160 days', now() - interval '21 hours'),
  ('00000000-0000-0000-0000-000000000008', 'lena@sardhana.test', now(), 'lena', 'Lena Fischer', 'member', 'Realtime systems and the backpressure nobody plans for.',
   NULL, NULL, now() - interval '120 days', now() - interval '24 hours'),
  ('00000000-0000-0000-0000-000000000009', 'sofia@sardhana.test', now(), 'sofia', 'Sofia Marin', 'member', NULL,
   NULL, NULL, now() - interval '80 days', now() - interval '27 hours');

-- Sessions ------------------------------------------------------------------
INSERT INTO timelapses (id, user_id, slug, title, summary, github_url, x_url,
                        storage_key, playback_url, thumbnail_url, duration_seconds,
                        session_minutes, status, submitted_at, published_at,
                        reviewed_by, reviewed_at, review_note, view_count, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000002', 'rewriting-the-borrow-checker-pass', 'Rewriting the borrow-checker pass',
   'Spent the session replacing the recursive walk in our lifetime inference with an explicit worklist. The recursion was blowing the stack on generated code, and one file in the test corpus nests closures fourteen deep.

The worklist version is uglier to read and about four times faster. Two tests still fail on early-return borrows; I left them failing rather than papering over them, and the commit says so.',
   'https://github.com/mira/lang/pull/812', NULL, 'uploads/00000000-0000-0000-0000-000000000002/rewriting-the-borrow-checker-pass.mp4',
   '/demo/borrow-checker.mp4', '/demo/borrow-checker.jpg', 18, 331, 'published',
   now() - interval '30 hours', now() - interval '26 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '26 hours', NULL, 4820, now() - interval '32 hours'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000003', 'payment-reconciler-double-refund', 'A payment reconciler that survives a double refund',
   'Our reconciler assumed a refund could only happen once per charge. A support agent and a webhook retry did it at the same moment and the ledger went negative.

This session is the rewrite: every mutation carries an idempotency key derived from the provider event id, and the ledger is append-only with a computed balance instead of a stored one.',
   'https://github.com/theo/ledger', 'https://x.com/theo', 'uploads/00000000-0000-0000-0000-000000000003/payment-reconciler-double-refund.mp4',
   '/demo/payment-reconciler.mp4', '/demo/payment-reconciler.jpg', 18, 488, 'published',
   now() - interval '60 hours', now() - interval '52 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '52 hours', NULL, 9310, now() - interval '62 hours'),
  ('00000000-0000-0000-0000-000000000a03', '00000000-0000-0000-0000-000000000004', 'four-hours-one-missing-index', 'Four hours finding one missing index',
   'A report page took nine seconds to load and nobody could say why. The session is mostly reading query plans and being wrong.

It turned out to be a correlated subquery in a view, three levels down, that nobody had opened since 2022. The fix is one index and two deleted lines.',
   'https://github.com/ana/reports', NULL, 'uploads/00000000-0000-0000-0000-000000000004/four-hours-one-missing-index.mp4',
   '/demo/index-hunt.mp4', '/demo/index-hunt.jpg', 18, 247, 'published',
   now() - interval '90 hours', now() - interval '80 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '80 hours', NULL, 6140, now() - interval '92 hours'),
  ('00000000-0000-0000-0000-000000000a04', '00000000-0000-0000-0000-000000000006', 'typography-pass-settings-screen', 'A typography pass on a dense settings screen',
   'No new features. The settings screen had eleven type sizes on it. This session cuts it to four, sets everything on a four-point rhythm, and moves the destructive actions into their own group at the bottom.',
   NULL, 'https://x.com/priya', 'uploads/00000000-0000-0000-0000-000000000006/typography-pass-settings-screen.mp4',
   '/demo/typography-pass.mp4', '/demo/typography-pass.jpg', 18, 196, 'published',
   now() - interval '130 hours', now() - interval '120 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '120 hours', NULL, 3270, now() - interval '132 hours'),
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-000000000005', 'board-bringup-without-uart', 'Bringing up a board with no working UART',
   'The debug serial line was dead, so the whole session is done by blinking one LED in morse. By the end the clock tree is configured, the bootloader hands off correctly, and the UART turns out to have been fine all along: the pin was muxed to the wrong peripheral.',
   'https://github.com/kenji/board-bringup', NULL, 'uploads/00000000-0000-0000-0000-000000000005/board-bringup-without-uart.mp4',
   '/demo/firmware-bringup.mp4', '/demo/firmware-bringup.jpg', 18, 615, 'published',
   now() - interval '170 hours', now() - interval '160 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '160 hours', NULL, 11240, now() - interval '172 hours'),
  ('00000000-0000-0000-0000-000000000a06', '00000000-0000-0000-0000-000000000007', 'rollback-before-the-migration', 'Writing the rollback before the migration',
   'We are splitting a table that forty services read from. The session is spent writing the down-migration first and proving it on a branch of production data, because the only migration worth trusting is one you have already reversed once.',
   'https://github.com/dan/platform', NULL, 'uploads/00000000-0000-0000-0000-000000000007/rollback-before-the-migration.mp4',
   '/demo/migration-rollback.mp4', '/demo/migration-rollback.jpg', 18, 402, 'published',
   now() - interval '220 hours', now() - interval '210 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '210 hours', NULL, 5480, now() - interval '222 hours'),
  ('00000000-0000-0000-0000-000000000a07', '00000000-0000-0000-0000-000000000008', 'websocket-backpressure', 'Adding backpressure to the websocket fan-out',
   'Slow clients were making the whole broadcast loop stall. This session adds a bounded buffer per connection and drops the slowest subscribers instead of blocking everyone else. The load test at the end pushes 40k messages a second through it.',
   'https://github.com/lena/realtime/pull/221', NULL, 'uploads/00000000-0000-0000-0000-000000000008/websocket-backpressure.mp4',
   '/demo/payment-reconciler.mp4', '/demo/payment-reconciler.jpg', 18, 284, 'in_review',
   now() - interval '3 hours', NULL,
   NULL, NULL, NULL, 0, now() - interval '5 hours'),
  ('00000000-0000-0000-0000-000000000a08', '00000000-0000-0000-0000-000000000002', 'incremental-parsing-second-attempt', 'Incremental parsing, second attempt',
   'Reworking the parser so an edit re-parses the changed subtree instead of the whole file. This session is the tree-diff groundwork: node identity, stable spans, and a test harness that replays real editing sessions against it.',
   'https://github.com/mira/lang', NULL, 'uploads/00000000-0000-0000-0000-000000000002/incremental-parsing-second-attempt.mp4',
   '/demo/index-hunt.mp4', '/demo/index-hunt.jpg', 18, 190, 'in_review',
   now() - interval '20 hours', NULL,
   NULL, NULL, NULL, 0, now() - interval '22 hours'),
  ('00000000-0000-0000-0000-000000000a09', '00000000-0000-0000-0000-000000000009', 'cleanup-session', 'Cleanup session',
   'Cleaned up some code in the project and fixed a few things that were bothering me for a while.',
   NULL, NULL, 'uploads/00000000-0000-0000-0000-000000000009/cleanup-session.mp4',
   '/demo/typography-pass.mp4', '/demo/typography-pass.jpg', 18, 35, 'rejected',
   now() - interval '40 hours', NULL,
   '00000000-0000-0000-0000-000000000001', now() - interval '34 hours', 'The write-up does not say what changed or why, and there is no link to the result. Describe the work in the recording and add the repository, then send it back.', 0, now() - interval '42 hours');

-- Sponsorships --------------------------------------------------------------
INSERT INTO donations (timelapse_id, creator_id, donor_id, donor_address, payout_address,
                       amount_lamports, message, signature, cluster, slot, status,
                       confirmed_at, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'b8dLcukC7edhDQ7cn5d4gEYkbUrMWeWQLGsCmrG6dLaY', 'MASi45ub7Qe4ZE36UT5G6cU4ud8Fhhe4deS4F3cw9KTA',
   1500000000, 'The dead ends were the most useful part. Please keep leaving them in.', 'YWXXL6A7pNpHXvmBa2EaQAmb2qaLix6mwHaQBPrFbbrZNhFgtsqwDtGuSptFDaYPo22sJXHDmfPVtoPQ6F7FXDNE', 'devnet', 308097578, 'confirmed',
   now() - interval '20 hours', now() - interval '20 hours'),
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000002', NULL, 'zWjeuzaTuyZ9bAaZ2xVrCf1rtACAXgo8c4MkaacXsr7y', 'MASi45ub7Qe4ZE36UT5G6cU4ud8Fhhe4deS4F3cw9KTA',
   250000000, NULL, 'gzgv1XiPti6vj8RsnqDXyCUshN6toSWSp6oBB92AezWtiAgufXjPAcc921toi7ap9UxDuxE2HEKZGqeMHbTv94pP', 'devnet', 309400209, 'confirmed',
   now() - interval '12 hours', now() - interval '12 hours'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'yNoVKf58ZTBqNAYT3j5qcdsyuMNmPfYetW5v6JXmj54o', 'b8dLcukC7edhDQ7cn5d4gEYkbUrMWeWQLGsCmrG6dLaY',
   2000000000, 'Watched this twice before touching our own reconciler.', '4GDJ3r7ZVc2qz5VMgZfZDmJVZbtXZGmayyHczDvV9T8SVM5jGU5EjLs8zrAnijQAHy9WFp7SyYBjvFBnUZSNTDPM', 'devnet', 301546759, 'confirmed',
   now() - interval '40 hours', now() - interval '40 hours'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'mLidkuVKnRyjP2WPBg8Y4ErK9pGSSxY6BVScJy9uUxcJ', 'b8dLcukC7edhDQ7cn5d4gEYkbUrMWeWQLGsCmrG6dLaY',
   750000000, NULL, 'oQ2NcWVn2RNagKZ58sFy76HJ3zrCJq9uUwkuHSAbZdYmM6J4tmCUz5J2h6tH6fwF5Hx8W1NcTJg93anG8BH4CDLh', 'devnet', 305117141, 'confirmed',
   now() - interval '30 hours', now() - interval '30 hours'),
  ('00000000-0000-0000-0000-000000000a03', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'MASi45ub7Qe4ZE36UT5G6cU4ud8Fhhe4deS4F3cw9KTA', 'yNoVKf58ZTBqNAYT3j5qcdsyuMNmPfYetW5v6JXmj54o',
   500000000, 'Keeping this for the next time a report page is slow.', 'aqEKVZkCJPt2H312oZcDZXGV7juiUjYbvySZLmEFNDvynoh9SP4v915hpyHUB46jvRxZjKfGmK3WCBJV1HQNcMG3', 'devnet', 305193352, 'confirmed',
   now() - interval '70 hours', now() - interval '70 hours'),
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000007', 'tcSSSS7XhS4D5EVB8Nf471dAb7Qg25xEgRAhHPfQX88w', 'mLidkuVKnRyjP2WPBg8Y4ErK9pGSSxY6BVScJy9uUxcJ',
   3200000000, 'Morse-code debugging deserves funding on principle.', 'EPC1NR6XJZiDGZr16Hu6ASe3S2LLhF6eawqAjznsyfRqMoYAKogiA3uvnzZhUomtZ9aqZdvut2uketznkmiF6239', 'devnet', 306051667, 'confirmed',
   now() - interval '150 hours', now() - interval '150 hours'),
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 'nTPkyRFA6CAFjF1YveCHK1ATbQgdM9mwZgikp4Wzxrxk', 'mLidkuVKnRyjP2WPBg8Y4ErK9pGSSxY6BVScJy9uUxcJ',
   1000000000, NULL, '7RvVc4h2hbkGYH1Wt5pZzb6ja5ppXHt5wHGoqEFpiWYwR5XkKr3ghiD5fANHipmLgd91X4YJk7mEkYKnaKWWWr8z', 'devnet', 309211975, 'confirmed',
   now() - interval '100 hours', now() - interval '100 hours'),
  ('00000000-0000-0000-0000-000000000a06', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 'b8dLcukC7edhDQ7cn5d4gEYkbUrMWeWQLGsCmrG6dLaY', 'tcSSSS7XhS4D5EVB8Nf471dAb7Qg25xEgRAhHPfQX88w',
   1250000000, 'Rollback first. Taking that to my team.', 'DL6X2KW5uZVJREE5e6ApaHQ9fuhZJy8nQFYzyYS2B1YkVSLoATPRM8vN1MqNvS8Dn1zpKHQ5SRxe5QUqJw4J74vj', 'devnet', 304791961, 'confirmed',
   now() - interval '200 hours', now() - interval '200 hours'),
  ('00000000-0000-0000-0000-000000000a04', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000008', 'hAGJUZMDrQsUy2tqhSyccEo64oTVgq9ixKY4c9BXTNKL', 'nTPkyRFA6CAFjF1YveCHK1ATbQgdM9mwZgikp4Wzxrxk',
   400000000, NULL, NULL, 'devnet', NULL, 'pending',
   NULL, now() - interval '2 hours');

-- Notes and bookmarks -------------------------------------------------------
INSERT INTO timelapse_notes (timelapse_id, author_id, body, timestamp_seconds)
VALUES
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000003', 'The part around the middle is worth watching twice. The fixpoint is computed over the dominator tree rather than the CFG, which is why the nested case stops miscompiling.', 12),
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000004', 'Leaving the two failing tests in rather than skipping them is the right call.', NULL),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000007', 'Deriving the idempotency key from the provider event id is the whole fix. Everything else follows from it.', 9),
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-000000000002', 'The moment the LED pattern changes at the end is a better demo than any logging output.', 15);

INSERT INTO bookmarks (user_id, timelapse_id)
VALUES
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000a05'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000a01'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000a06');

-- Audit trail: one entry per review decision above ---------------------------
INSERT INTO audit_log (actor_id, action, subject_type, subject_id, metadata, created_at)
SELECT reviewed_by,
       CASE status WHEN 'published' THEN 'timelapse.approve' ELSE 'timelapse.reject' END,
       'timelapse', id::text,
       CASE status WHEN 'published' THEN jsonb_build_object('title', title)
                   ELSE jsonb_build_object('title', title, 'note', review_note) END,
       reviewed_at
  FROM timelapses
 WHERE reviewed_at IS NOT NULL
 ORDER BY reviewed_at;

-- Denormalised counters ------------------------------------------------------
SELECT recount_totals();

COMMIT;
