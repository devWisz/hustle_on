-- Reverse 0013_wallet_identity.
--
-- This one is honestly lossy, and the loss is documented rather than hidden.
--
-- Going back means email is the identity again, and email is NOT NULL UNIQUE.
-- Accounts created under the wallet model have no email address at all — nobody
-- was ever asked for one — so there is no value to restore. The choice is to
-- invent one or to delete the account. Inventing is reversible and deleting is
-- not, so every wallet-only account gets a placeholder address derived from its
-- own wallet, under a reserved TLD that can never receive mail. Those rows are
-- real accounts with a fabricated contact address, and anyone reverting should
-- know that before they do it.
--
-- Anything a sign-in challenge was doing is dropped: with email back in charge,
-- a challenge with no user_id belongs to no flow at all.

-- 1. Give every wallet-only account a placeholder address so the NOT NULL and
--    UNIQUE constraints can be restored without deleting anybody.
UPDATE users
   SET email = (wallet_address || '@wallet.invalid')::citext
 WHERE email IS NULL AND wallet_address IS NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
UPDATE users SET email_verified_at = now() WHERE email IS NOT NULL AND email_verified_at IS NULL;

-- 2. Drop the wallet identity. This cascades to nothing: no foreign key points
--    at it.
ALTER TABLE users DROP COLUMN IF EXISTS wallet_address;

-- 3. wallet_challenges returns to payout-only. Anonymous challenges cannot be
--    represented at all once user_id is NOT NULL, so they are removed.
DELETE FROM wallet_challenges WHERE user_id IS NULL;
DROP INDEX IF EXISTS wallet_challenges_address_idx;
ALTER TABLE wallet_challenges DROP CONSTRAINT IF EXISTS wallet_challenges_address_nonce_key;
ALTER TABLE wallet_challenges DROP COLUMN IF EXISTS purpose;
ALTER TABLE wallet_challenges ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE wallet_challenges
    ADD CONSTRAINT wallet_challenges_user_id_address_nonce_key UNIQUE (user_id, address, nonce);

-- 4. Restore the sign-in link table exactly as 0002 created it.
CREATE TABLE IF NOT EXISTS magic_link_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
    email           citext NOT NULL,
    token_hash      bytea NOT NULL UNIQUE,
    expires_at      timestamptz NOT NULL,
    consumed_at     timestamptz,
    request_ip      inet,
    request_user_agent text,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS magic_link_tokens_email_idx
    ON magic_link_tokens (email, created_at DESC);
CREATE INDEX IF NOT EXISTS magic_link_tokens_expiry_idx
    ON magic_link_tokens (expires_at) WHERE consumed_at IS NULL;

-- 5. And the purge function in its original three-column shape.
DROP FUNCTION IF EXISTS purge_expired_auth(interval);
CREATE FUNCTION purge_expired_auth(keep interval DEFAULT interval '30 days')
RETURNS TABLE (links bigint, challenges bigint, sessions bigint) AS $$
DECLARE
    l bigint;
    c bigint;
    s bigint;
BEGIN
    DELETE FROM magic_link_tokens WHERE expires_at < now() - keep;
    GET DIAGNOSTICS l = ROW_COUNT;
    DELETE FROM wallet_challenges WHERE expires_at < now() - keep;
    GET DIAGNOSTICS c = ROW_COUNT;
    DELETE FROM sessions
     WHERE (expires_at < now() - keep) OR (revoked_at IS NOT NULL AND revoked_at < now() - keep);
    GET DIAGNOSTICS s = ROW_COUNT;
    RETURN QUERY SELECT l, c, s;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION purge_expired_auth(interval) TO sardhana_app;
