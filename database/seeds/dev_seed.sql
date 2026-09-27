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
  ('00000000-0000-0000-0000-000000000002', 'ana@sardhana.test', now(), 'ana', 'Ana Ruiz', 'member', 'Painter. I record whole commissions, from the first wash to the last signature.',
   'MASi45ub7Qe4ZE36UT5G6cU4ud8Fhhe4deS4F3cw9KTA', now(), now() - interval '360 days', now() - interval '6 hours'),
  ('00000000-0000-0000-0000-000000000003', 'kenji@sardhana.test', now(), 'kenji', 'Kenji Watanabe', 'member', 'Furniture maker working out of a small shared workshop. Hardwoods, hand tools, one table at a time.',
   'b8dLcukC7edhDQ7cn5d4gEYkbUrMWeWQLGsCmrG6dLaY', now(), now() - interval '320 days', now() - interval '9 hours'),
  ('00000000-0000-0000-0000-000000000004', 'priya@sardhana.test', now(), 'priya', 'Priya Raman', 'member', 'Pattern cutter and seamstress building a small clothing label, one prototype at a time.',
   'yNoVKf58ZTBqNAYT3j5qcdsyuMNmPfYetW5v6JXmj54o', now(), now() - interval '280 days', now() - interval '12 hours'),
  ('00000000-0000-0000-0000-000000000005', 'theo@sardhana.test', now(), 'theo', 'Theo Lindqvist', 'member', 'Software engineer who does his best work after midnight. Mostly data tools and dashboards.',
   'mLidkuVKnRyjP2WPBg8Y4ErK9pGSSxY6BVScJy9uUxcJ', now(), now() - interval '240 days', now() - interval '15 hours'),
  ('00000000-0000-0000-0000-000000000006', 'dan@sardhana.test', now(), 'dan', 'Dan Whitfield', 'member', 'Co-founder of a four-person startup. I film launch days so the team can see how the day went.',
   'nTPkyRFA6CAFjF1YveCHK1ATbQgdM9mwZgikp4Wzxrxk', now(), now() - interval '200 days', now() - interval '18 hours'),
  ('00000000-0000-0000-0000-000000000007', 'mira@sardhana.test', now(), 'mira', 'Mira Okonkwo', 'member', 'Freelance designer and developer. Portfolios, landing pages and small sites.',
   'tcSSSS7XhS4D5EVB8Nf471dAb7Qg25xEgRAhHPfQX88w', now(), now() - interval '160 days', now() - interval '21 hours'),
  ('00000000-0000-0000-0000-000000000008', 'lena@sardhana.test', now(), 'lena', 'Lena Fischer', 'member', 'Ceramics student documenting a year of learning the wheel.',
   NULL, NULL, now() - interval '120 days', now() - interval '24 hours'),
  ('00000000-0000-0000-0000-000000000009', 'sofia@sardhana.test', now(), 'sofia', 'Sofia Marin', 'member', NULL,
   NULL, NULL, now() - interval '80 days', now() - interval '27 hours');

-- Sessions ------------------------------------------------------------------
INSERT INTO timelapses (id, user_id, slug, title, summary, github_url, x_url,
                        storage_key, playback_url, thumbnail_url, duration_seconds,
                        session_minutes, status, submitted_at, published_at,
                        reviewed_by, reviewed_at, review_note, view_count, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000002', 'portrait-commission', 'Finishing a portrait commission in one sitting',
   'A client asked for a large abstract portrait for their studio. This session is the final six hours: blocking the colour fields, building up the face in layers, and fixing the left side twice after it read as flat from across the room.

The timelapse shows every false start. The finished piece shipped the next morning.',
   NULL, 'https://x.com/ana', 'uploads/00000000-0000-0000-0000-000000000002/portrait-commission.mp4',
   '/demo/painting-studio.mp4', '/demo/painting-studio.jpg', 12, 372, 'published',
   now() - interval '30 hours', now() - interval '26 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '26 hours', NULL, 4820, now() - interval '32 hours'),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000003', 'walnut-side-table', 'Building a walnut side table from rough boards',
   'Started with two rough-sawn walnut boards and ended with a finished side table. Most of the session is milling: flattening, jointing and planing until the boards were square, then cutting the joinery by hand.

One leg came out a millimetre short and I had to recut all four to match. It is in the recording.',
   NULL, NULL, 'uploads/00000000-0000-0000-0000-000000000003/walnut-side-table.mp4',
   '/demo/wood-workshop.mp4', '/demo/wood-workshop.jpg', 15, 488, 'published',
   now() - interval '60 hours', now() - interval '52 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '52 hours', NULL, 9310, now() - interval '62 hours'),
  ('00000000-0000-0000-0000-000000000a03', '00000000-0000-0000-0000-000000000004', 'lined-jacket-prototype', 'Sewing the first prototype of a lined jacket',
   'The first physical sample for my label''s autumn jacket. The session covers cutting the shell and lining, setting the sleeves, and a long stretch redoing the collar after it twisted on the first attempt.',
   NULL, 'https://x.com/priya', 'uploads/00000000-0000-0000-0000-000000000004/lined-jacket-prototype.mp4',
   '/demo/sewing-studio.mp4', '/demo/sewing-studio.jpg', 16, 247, 'published',
   now() - interval '90 hours', now() - interval '80 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '80 hours', NULL, 6140, now() - interval '92 hours'),
  ('00000000-0000-0000-0000-000000000a04', '00000000-0000-0000-0000-000000000005', 'late-night-trading-dashboard', 'A late-night push on a live trading dashboard',
   'The dashboard was lagging seconds behind the market feed. This session moves the chart updates off the main thread and batches them, then load-tests it against a replay of a busy morning. The lag went from four seconds to under a hundred milliseconds.',
   'https://github.com/theo/dashboard/pull/41', NULL, 'uploads/00000000-0000-0000-0000-000000000005/late-night-trading-dashboard.mp4',
   '/demo/late-night-code.mp4', '/demo/late-night-code.jpg', 14, 331, 'published',
   now() - interval '130 hours', now() - interval '120 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '120 hours', NULL, 3270, now() - interval '132 hours'),
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-000000000006', 'launch-day-four-person-team', 'Launch day with a four-person team',
   'We launched the public beta of our booking app. The recording covers the whole working day in the office: final fixes in the morning, the release at noon, and the afternoon answering the first wave of support messages.',
   NULL, 'https://x.com/dan', 'uploads/00000000-0000-0000-0000-000000000006/launch-day-four-person-team.mp4',
   '/demo/office-sprint.mp4', '/demo/office-sprint.jpg', 9, 615, 'published',
   now() - interval '170 hours', now() - interval '160 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '160 hours', NULL, 11240, now() - interval '172 hours'),
  ('00000000-0000-0000-0000-000000000a06', '00000000-0000-0000-0000-000000000007', 'portfolio-rebuild-afternoon', 'Rebuilding my portfolio site in an afternoon',
   'My old portfolio took eight seconds to load on a phone. This session rebuilds it from scratch: a simpler layout, compressed images, and a contact form that actually sends. The new site loads in under a second.',
   'https://github.com/mira/portfolio', NULL, 'uploads/00000000-0000-0000-0000-000000000007/portfolio-rebuild-afternoon.mp4',
   '/demo/writing-desk.mp4', '/demo/writing-desk.jpg', 12, 402, 'published',
   now() - interval '220 hours', now() - interval '210 hours',
   '00000000-0000-0000-0000-000000000001', now() - interval '210 hours', NULL, 5480, now() - interval '222 hours'),
  ('00000000-0000-0000-0000-000000000a07', '00000000-0000-0000-0000-000000000008', 'first-set-of-bowls', 'Throwing my first matching set of bowls',
   'Four bowls that are meant to match. The session is mostly centring clay and starting again when the walls went uneven. By the end three of the four are within a few millimetres of each other.',
   NULL, NULL, 'uploads/00000000-0000-0000-0000-000000000008/first-set-of-bowls.mp4',
   '/demo/painting-studio.mp4', '/demo/painting-studio.jpg', 12, 284, 'in_review',
   now() - interval '3 hours', NULL,
   NULL, NULL, NULL, 0, now() - interval '5 hours'),
  ('00000000-0000-0000-0000-000000000a08', '00000000-0000-0000-0000-000000000002', 'gallery-mural-first-coat', 'The first coat on a gallery mural',
   'Laying out and painting the base coat of a five-metre mural for a local gallery. The session covers the grid, transferring the sketch and the first pass of colour.',
   NULL, 'https://x.com/ana', 'uploads/00000000-0000-0000-0000-000000000002/gallery-mural-first-coat.mp4',
   '/demo/painting-studio.mp4', '/demo/painting-studio.jpg', 12, 190, 'in_review',
   now() - interval '20 hours', NULL,
   NULL, NULL, NULL, 0, now() - interval '22 hours'),
  ('00000000-0000-0000-0000-000000000a09', '00000000-0000-0000-0000-000000000009', 'work-session', 'Work session',
   'Worked on some stuff for a few hours and made some progress on it.',
   NULL, NULL, 'uploads/00000000-0000-0000-0000-000000000009/work-session.mp4',
   '/demo/writing-desk.mp4', '/demo/writing-desk.jpg', 12, 35, 'rejected',
   now() - interval '40 hours', NULL,
   '00000000-0000-0000-0000-000000000001', now() - interval '34 hours', 'The write-up does not say what you worked on or what came out of it. Describe the work in the recording and link the result if it is online, then send it back.', 0, now() - interval '42 hours');

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
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000007', 'tcSSSS7XhS4D5EVB8Nf471dAb7Qg25xEgRAhHPfQX88w', 'nTPkyRFA6CAFjF1YveCHK1ATbQgdM9mwZgikp4Wzxrxk',
   3200000000, 'Morse-code debugging deserves funding on principle.', 'EPC1NR6XJZiDGZr16Hu6ASe3S2LLhF6eawqAjznsyfRqMoYAKogiA3uvnzZhUomtZ9aqZdvut2uketznkmiF6239', 'devnet', 306051667, 'confirmed',
   now() - interval '150 hours', now() - interval '150 hours'),
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', 'yNoVKf58ZTBqNAYT3j5qcdsyuMNmPfYetW5v6JXmj54o', 'nTPkyRFA6CAFjF1YveCHK1ATbQgdM9mwZgikp4Wzxrxk',
   1000000000, NULL, '7RvVc4h2hbkGYH1Wt5pZzb6ja5ppXHt5wHGoqEFpiWYwR5XkKr3ghiD5fANHipmLgd91X4YJk7mEkYKnaKWWWr8z', 'devnet', 309211975, 'confirmed',
   now() - interval '100 hours', now() - interval '100 hours'),
  ('00000000-0000-0000-0000-000000000a06', '00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', 'b8dLcukC7edhDQ7cn5d4gEYkbUrMWeWQLGsCmrG6dLaY', 'tcSSSS7XhS4D5EVB8Nf471dAb7Qg25xEgRAhHPfQX88w',
   1250000000, 'Rollback first. Taking that to my team.', 'DL6X2KW5uZVJREE5e6ApaHQ9fuhZJy8nQFYzyYS2B1YkVSLoATPRM8vN1MqNvS8Dn1zpKHQ5SRxe5QUqJw4J74vj', 'devnet', 304791961, 'confirmed',
   now() - interval '200 hours', now() - interval '200 hours'),
  ('00000000-0000-0000-0000-000000000a04', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000008', 'hAGJUZMDrQsUy2tqhSyccEo64oTVgq9ixKY4c9BXTNKL', 'mLidkuVKnRyjP2WPBg8Y4ErK9pGSSxY6BVScJy9uUxcJ',
   400000000, NULL, NULL, 'devnet', NULL, 'pending',
   NULL, now() - interval '2 hours');

-- Notes and bookmarks -------------------------------------------------------
INSERT INTO timelapse_notes (timelapse_id, author_id, body, timestamp_seconds)
VALUES
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000003', 'The part around the middle is worth watching twice. Seeing where you stepped back and changed the colour of the face taught me more than the finished piece.', 6),
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-000000000004', 'Leaving the false starts in is the right call. Please keep doing that.', NULL),
  ('00000000-0000-0000-0000-000000000a02', '00000000-0000-0000-0000-000000000006', 'Recutting all four legs instead of shimming one is the lesson here.', 9),
  ('00000000-0000-0000-0000-000000000a05', '00000000-0000-0000-0000-000000000002', 'The moment the release goes out at noon is a better demo than any launch video.', 4);

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
