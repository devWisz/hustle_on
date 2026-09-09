-- Passwordless authentication.
--
-- No password hash is stored anywhere in this schema, so there is nothing to
-- leak. Sign-in links and session tokens are held only as SHA-256 digests; the
-- plaintext of each exists in exactly one place — the user's inbox, or their
-- cookie — and never on our side.

CREATE TABLE magic_link_tokens (
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

-- Supports the per-address request throttle, which counts recent rows by email.
CREATE INDEX magic_link_tokens_email_idx ON magic_link_tokens (email, created_at DESC);
CREATE INDEX magic_link_tokens_expiry_idx ON magic_link_tokens (expires_at)
    WHERE consumed_at IS NULL;

CREATE TABLE sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      bytea NOT NULL UNIQUE,
    ip              inet,
    user_agent      text,
    expires_at      timestamptz NOT NULL,
    revoked_at      timestamptz,
    last_used_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions (user_id, created_at DESC);

-- Nonces for wallet proofs. The account signs one of these with the key for the
-- address it wants to be paid at, which is what turns a typed-in string into a
-- verified payout address.
CREATE TABLE wallet_challenges (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address         text NOT NULL,
    nonce           text NOT NULL,
    expires_at      timestamptz NOT NULL,
    consumed_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, address, nonce)
);

-- Append-only record of every review decision and every account action an
-- operator takes. A creator whose upload was rejected can always be told who
-- decided that and when.
CREATE TABLE audit_log (
    id              bigserial PRIMARY KEY,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    action          text NOT NULL,
    subject_type    text NOT NULL,
    subject_id      text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_subject_idx ON audit_log (subject_type, subject_id, created_at DESC);
