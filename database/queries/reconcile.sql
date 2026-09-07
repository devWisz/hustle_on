-- Recompute denormalised counters. Run from a maintenance job; each statement
-- is independent so a partial run leaves no inconsistency behind.

UPDATE profiles p SET follower_count = c.n
FROM (SELECT following_id, count(*) n FROM follows GROUP BY 1) c
WHERE p.user_id = c.following_id AND p.follower_count <> c.n;

UPDATE profiles p SET video_count = c.n
FROM (SELECT user_id, count(*) n FROM videos
      WHERE status = 'published' GROUP BY 1) c
WHERE p.user_id = c.user_id AND p.video_count <> c.n;

UPDATE videos v SET comment_count = c.n
FROM (SELECT video_id, count(*) n FROM comments
      WHERE status = 'visible' GROUP BY 1) c
WHERE v.id = c.video_id AND v.comment_count <> c.n;

UPDATE videos v SET sponsor_total_lamports = s.total, sponsor_count = s.n
FROM (SELECT video_id, sum(amount) total, count(*) n FROM sponsorships
      WHERE status = 'confirmed' AND video_id IS NOT NULL GROUP BY 1) s
WHERE v.id = s.video_id;

UPDATE profiles p SET sponsor_total_lamports = s.total
FROM (SELECT creator_id, sum(amount) total FROM sponsorships
      WHERE status = 'confirmed' GROUP BY 1) s
WHERE p.user_id = s.creator_id AND p.sponsor_total_lamports <> s.total;
