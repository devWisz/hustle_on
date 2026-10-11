-- 0012, reversed. Dropping the column forgets who had completed the profile step,
-- which costs nothing: the only consequence is that every account is asked once
-- more after a future re-apply, and the fields themselves are untouched.
DROP INDEX IF EXISTS users_pending_onboarding_idx;
ALTER TABLE users DROP COLUMN IF EXISTS onboarded_at;
