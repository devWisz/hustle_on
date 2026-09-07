-- Development fixtures. Safe to run repeatedly; never run against production.
BEGIN;

INSERT INTO users (id, email, email_verified_at, handle, display_name, role)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'maya@example.com',  now(), 'maya',   'Maya Rao',      'member'),
    ('22222222-2222-4222-8222-222222222222', 'dev@example.com',   now(), 'kaito',  'Kaito Mori',    'member'),
    ('33333333-3333-4333-8333-333333333333', 'admin@example.com', now(), 'admin',  'Platform Admin','admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, headline, bio, location, skills, open_to_work, hourly_rate_usd)
VALUES
    ('11111111-1111-4111-8111-111111111111',
     'Systems engineer building a storage engine in public',
     'Five hours a day on a log-structured store written in Rust. Everything recorded.',
     'Bengaluru', ARRAY['rust','databases','systems'], true, 95.00),
    ('22222222-2222-4222-8222-222222222222',
     'Product designer shipping one interface a week',
     'Design sessions in full, from blank artboard to handoff.',
     'Osaka', ARRAY['product-design','figma','prototyping'], true, 80.00),
    ('33333333-3333-4333-8333-333333333333', 'Operations', NULL, NULL, '{}', false, NULL)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO social_links (user_id, platform, username, url, verified_at)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'x',      'mayabuilds', 'https://x.com/mayabuilds', now()),
    ('11111111-1111-4111-8111-111111111111', 'github', 'mayarao',    'https://github.com/mayarao', now()),
    ('22222222-2222-4222-8222-222222222222', 'github', 'kaitomori',  'https://github.com/kaitomori', now())
ON CONFLICT (user_id, platform) DO NOTHING;

INSERT INTO videos (id, user_id, slug, title, description, status, visibility,
                    duration_seconds, session_minutes, published_at)
VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111',
     'write-ahead-log-day-14', 'Write-ahead log, day 14',
     'Crash recovery path, start to finish. Six hours compressed to four minutes.',
     'published', 'public', 240, 360, now() - interval '2 days'),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '22222222-2222-4222-8222-222222222222',
     'checkout-flow-rebuild', 'Checkout flow rebuild',
     'Blank file to shipped prototype in one sitting.',
     'published', 'public', 180, 300, now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tags (name) VALUES ('rust'), ('databases'), ('design'), ('frontend')
ON CONFLICT (name) DO NOTHING;

INSERT INTO comments (video_id, user_id, body)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        '22222222-2222-4222-8222-222222222222',
        'The recovery replay at 2:10 is the clearest explanation of fsync ordering I have seen.')
ON CONFLICT DO NOTHING;

INSERT INTO jobs (client_id, slug, title, description, skills, engagement,
                  budget_min_usd, budget_max_usd, status, published_at)
VALUES ('22222222-2222-4222-8222-222222222222', 'rust-storage-consultant',
        'Rust storage engine consultant',
        'Two week engagement reviewing and hardening a log-structured storage layer. Deliverables are recorded work sessions plus a written report.',
        ARRAY['rust','databases'], 'milestone', 4000, 8000, 'open', now())
ON CONFLICT (slug) DO NOTHING;

UPDATE profiles p SET video_count = (
    SELECT count(*) FROM videos v WHERE v.user_id = p.user_id AND v.status = 'published'
);

COMMIT;
