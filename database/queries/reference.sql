-- Reference queries. These mirror the shapes the API issues; keep them in sync
-- so query plans can be checked with EXPLAIN without booting the service.

-- name: HomeFeed
-- Newest published public videos with their creator, keyset paginated.
SELECT v.id, v.slug, v.title, v.thumbnail_url, v.duration_seconds,
       v.view_count, v.sponsor_total_lamports, v.published_at,
       u.handle, u.display_name, p.avatar_url
FROM videos v
JOIN users u ON u.id = v.user_id
JOIN profiles p ON p.user_id = u.id
WHERE v.status = 'published'
  AND v.visibility = 'public'
  AND u.status = 'active'
  AND ($1::timestamptz IS NULL OR v.published_at < $1)
ORDER BY v.published_at DESC
LIMIT $2;

-- name: CreatorEarnings
-- Confirmed sponsorship totals per creator over a window.
SELECT s.creator_id,
       count(*) AS sponsorship_count,
       sum(s.amount) AS total_lamports,
       count(DISTINCT s.sponsor_id) AS unique_sponsors
FROM sponsorships s
WHERE s.status = 'confirmed'
  AND s.created_at >= now() - $1::interval
GROUP BY s.creator_id
ORDER BY total_lamports DESC;

-- name: TopLevelComments
SELECT c.id, c.body, c.like_count, c.reply_count, c.created_at, c.edited_at,
       u.handle, u.display_name, p.avatar_url
FROM comments c
JOIN users u ON u.id = c.user_id
LEFT JOIN profiles p ON p.user_id = u.id
WHERE c.video_id = $1
  AND c.parent_id IS NULL
  AND c.status = 'visible'
ORDER BY c.created_at DESC
LIMIT $2 OFFSET $3;

-- name: TalentSearch
-- Creators open to work, ranked by recent sponsorship signal.
SELECT u.handle, u.display_name, p.headline, p.skills, p.hourly_rate_usd,
       p.sponsor_total_lamports, p.video_count
FROM users u
JOIN profiles p ON p.user_id = u.id
WHERE u.status = 'active'
  AND p.open_to_work
  AND ($1::text[] IS NULL OR p.skills && $1)
ORDER BY p.sponsor_total_lamports DESC, p.video_count DESC
LIMIT $2;

-- name: ModerationQueue
SELECT r.id, r.subject_type, r.subject_id, r.reason, r.detail, r.created_at,
       count(*) OVER (PARTITION BY r.subject_type, r.subject_id) AS report_count
FROM reports r
WHERE r.status IN ('open', 'reviewing')
ORDER BY report_count DESC, r.created_at ASC
LIMIT $1;
