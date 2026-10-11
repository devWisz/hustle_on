-- 0014: email and password as a second way into an account.
--
-- Wallet sign-in stays exactly as it is. This adds the thing most people expect
-- to find: a name, an email address and a password. Nothing here sends mail —
-- there is no verification link and no reset link, because the mail path was
-- deliberately removed. That is a real limitation and the honest way to handle it
-- is to say so plainly rather than to half-build a reset flow that cannot deliver
-- anything: an account created here can change its password while signed in, and
-- cannot recover one it has forgotten. See docs/auth.md.
--
-- Both identities can coexist on one row. An account made with a password is the
-- same kind of account as one made with a wallet: it can upload, be sponsored,
-- and later link a wallet to receive payouts — which is the only thing a wallet
-- is strictly required for.

-- 1. The credential. Nullable, because a wallet-only account has never had one.
ALTER TABLE users ADD COLUMN password_hash text;

-- 2. An email address now identifies an account at sign-in, so it has to be
--    unique — but only among the rows that have one. A plain UNIQUE constraint
--    would not do: it treats every NULL as distinct, which is what we want, but it
--    cannot be added to a column that was deliberately made non-unique in 0013
--    without first proving there are no duplicates. A partial unique index states
--    the rule exactly and only covers the rows it is about.
--
--    `citext` makes the comparison case-insensitive, so Ada@example.com and
--    ada@example.com are one account rather than two.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
    ON users (email) WHERE email IS NOT NULL;

-- 3. Every account needs at least one way in. Without this, a row could exist
--    that nothing can authenticate — which is precisely the state migration 0013
--    left the pre-existing email-only accounts in, and the reason this project
--    had to clean one up by hand.
ALTER TABLE users ADD CONSTRAINT users_identity_check
    CHECK (email IS NOT NULL OR wallet_address IS NOT NULL);

-- 4. A password without an email address could never be used, because the email
--    is what a password sign-in looks the account up by.
ALTER TABLE users ADD CONSTRAINT users_password_needs_email_check
    CHECK (password_hash IS NULL OR email IS NOT NULL);

COMMENT ON COLUMN users.password_hash IS
    'Argon2id encoded hash, or NULL for an account that signs in with a wallet only. Never selected onto a wire type.';
