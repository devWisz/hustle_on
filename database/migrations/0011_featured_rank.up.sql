-- 0011: an explicit order for the curated front page.
--
-- 0010 gave a session a boolean "featured" flag and ordered the shelf by
-- featured_at, which means the front page reads newest-featured-first and cannot
-- be arranged. Reordering is the point of a curated shelf: the operator decides
-- what a first-time visitor sees first, and that is not the same as what they
-- happened to feature most recently.
--
-- featured_rank holds that order. NULL means "not featured" — there is no state
-- in which a session is on the shelf without a position — so a single column
-- answers both "is it featured" and "where".
--
-- The unique index is the part that makes the order meaningful rather than
-- merely suggestive: two sessions cannot claim the same position, so a reorder
-- is a permutation of a set rather than a set of independent edits, and a bug
-- that assigned a duplicate is rejected by the database instead of quietly
-- rendering one of them at random.

ALTER TABLE timelapses ADD COLUMN featured_rank integer
    CHECK (featured_rank IS NULL OR featured_rank > 0);

-- Give the existing shelf positions in the order it was already displayed in,
-- so applying this migration changes nothing a visitor can see.
WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY featured_at DESC, id) AS position
      FROM timelapses
     WHERE featured_at IS NOT NULL
)
UPDATE timelapses t
   SET featured_rank = ranked.position
  FROM ranked
 WHERE t.id = ranked.id;

-- The old index served "most recently featured"; the shelf is now read in rank
-- order, so it is replaced rather than kept alongside.
DROP INDEX IF EXISTS timelapses_featured_idx;
CREATE UNIQUE INDEX timelapses_featured_rank_key
    ON timelapses (featured_rank) WHERE featured_rank IS NOT NULL;

COMMENT ON COLUMN timelapses.featured_rank IS
    'Position on the curated front page, 1-based. NULL means not featured.';
