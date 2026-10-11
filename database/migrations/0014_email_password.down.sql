-- Reverse 0014_email_password.
--
-- Losing the password hashes is the point of reverting: going back to wallet-only
-- sign-in means no account can be authenticated by a password, and keeping a
-- column of hashes that nothing can use would be a credential store with no
-- purpose. The accounts themselves survive — an account created here has an email
-- address and no wallet, and it becomes unreachable, exactly as the pre-0013
-- accounts were. `make preflight` reports those, which is how it was caught last
-- time.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_needs_email_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identity_check;
DROP INDEX IF EXISTS users_email_unique_idx;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
