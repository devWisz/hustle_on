-- 0011, reversed. The shelf goes back to being ordered by when a session was
-- featured, which is the state 0010 left behind.
--
-- Nothing is lost that 0010 recorded: featured_at is untouched by this
-- migration's up and down, so dropping featured_rank only discards the manual
-- order, not the fact of being featured.

DROP INDEX IF EXISTS timelapses_featured_rank_key;
CREATE INDEX timelapses_featured_idx
    ON timelapses (featured_at DESC)
    WHERE featured_at IS NOT NULL AND status = 'published';

ALTER TABLE timelapses DROP COLUMN IF EXISTS featured_rank;
