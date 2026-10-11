-- 0012: an account is not a profile.
--
-- Signing in creates a row from an email address alone: a handle derived from it
-- and a display name identical to that handle. That is enough to own a session,
-- and not enough to be credited for one — a creator's name is what appears on
-- every card, in the feed and beside their work, and until now the site filled it
-- in with whatever the address happened to be.
--
-- onboarded_at records that the person has chosen their own handle and display
-- name. It is deliberately not backfilled: an existing account has never been
-- asked, so treating it as complete would mean nobody is ever asked, and the
-- derived-handle default would become the product's idea of a name.
--
-- NULL therefore means "has not chosen yet", and the app sends those accounts to
-- the profile step once, immediately after their first sign-in.

ALTER TABLE users ADD COLUMN onboarded_at timestamptz;

COMMENT ON COLUMN users.onboarded_at IS
    'When the account holder chose their own handle and display name, or NULL if they never have.';

-- The profile step is looked up by "is this account done", so the index is on the
-- rare value rather than the common one.
CREATE INDEX users_pending_onboarding_idx ON users (created_at) WHERE onboarded_at IS NULL;
