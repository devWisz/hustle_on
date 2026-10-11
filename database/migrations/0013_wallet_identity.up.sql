-- 0013: the wallet is the account.
--
-- Until now an account was an email address and a sign-in link was emailed to
-- it. That made Resend — a third party — a hard dependency of logging in at all:
-- no API key, no way in; a bounced mail, no way in; and every sign-in wrote a
-- row into a table whose only purpose was to hold a secret in flight.
--
-- Sign-in is now a signature. The browser asks for a nonce, the wallet signs it,
-- and the server verifies the ed25519 signature against the address before the
-- session is issued. There is no link to deliver and no inbox to wait on.
--
-- Email is kept as optional contact information on the profile and nothing else.
-- It is deliberately no longer unique and no longer NOT NULL, and it can never
-- be used to authenticate.

-- 1. The identity. Nullable only because the accounts that exist when this
--    migration runs have yet to link a wallet; every account created from now on
--    gets one at its first sign-in. An address may back exactly one account.
ALTER TABLE users ADD COLUMN wallet_address citext UNIQUE
    CHECK (wallet_address IS NULL OR length(wallet_address) BETWEEN 32 AND 44);

-- 2. Email stops being a credential. The unique constraint has to go: two people
--    may legitimately share a contact address, and enforcing uniqueness on a
--    field that no longer identifies anyone would only reject valid sign-ups.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP COLUMN email_verified_at;

-- 3. Sign-in links are gone, so the table that held them goes too. Nothing else
--    references it.
DROP TABLE IF EXISTS magic_link_tokens;

-- 4. Challenges now serve two purposes, and a sign-in challenge cannot name the
--    account it is for — the account may not exist yet. That is why user_id
--    becomes nullable and a purpose column is added to tell the two apart.
--
--    The uniqueness rule changes with it. It used to be `(user_id, address,
--    nonce)`, which cannot work for sign-in: NULLs are distinct in a UNIQUE
--    index, so every anonymous challenge would be "unique" and the constraint
--    would guard nothing. `(address, nonce)` is the real invariant — one nonce
--    is meaningful for one address, whoever is asking.
ALTER TABLE wallet_challenges ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE wallet_challenges ADD COLUMN purpose text NOT NULL DEFAULT 'payout'
    CHECK (purpose IN ('payout', 'signin'));
ALTER TABLE wallet_challenges
    DROP CONSTRAINT IF EXISTS wallet_challenges_user_id_address_nonce_key;
ALTER TABLE wallet_challenges
    ADD CONSTRAINT wallet_challenges_address_nonce_key UNIQUE (address, nonce);

-- Sign-in challenges are looked up by address alone before any session exists,
-- and the expiry sweep that already runs against this table now has more rows to
-- consider.
CREATE INDEX IF NOT EXISTS wallet_challenges_address_idx
    ON wallet_challenges (address, created_at DESC);

COMMENT ON COLUMN users.wallet_address IS
    'The Solana address that signs in for this account. Proven by an ed25519 signature at sign-in.';
COMMENT ON COLUMN users.email IS
    'Optional contact address. Not a credential, not unique, never used to sign in.';
COMMENT ON COLUMN wallet_challenges.purpose IS
    'signin challenges are created before an account exists; payout challenges re-point where money is sent.';

-- 5. purge_expired_auth() still deletes from the table dropped above, so the
--    first maintenance run after this migration would fail — and it runs at
--    start-up, which means the API would not come up at all.
--
--    Its result names the categories it removed, so the return type changes and
--    that is the one thing CREATE OR REPLACE cannot do. Hence the drop. The drop
--    also takes 0009's EXECUTE grant with it, which is why it is re-made below:
--    the API calls this function at boot and daily, and losing the grant would
--    surface as a permission error on a maintenance path nobody watches.
DROP FUNCTION IF EXISTS purge_expired_auth(interval);
CREATE FUNCTION purge_expired_auth(keep interval DEFAULT interval '30 days')
RETURNS TABLE (challenges bigint, sessions bigint) AS $$
DECLARE
    c bigint;
    s bigint;
BEGIN
    DELETE FROM wallet_challenges WHERE expires_at < now() - keep;
    GET DIAGNOSTICS c = ROW_COUNT;
    DELETE FROM sessions
     WHERE (expires_at < now() - keep) OR (revoked_at IS NOT NULL AND revoked_at < now() - keep);
    GET DIAGNOSTICS s = ROW_COUNT;
    RETURN QUERY SELECT c, s;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION purge_expired_auth(interval) TO sardhana_app;
