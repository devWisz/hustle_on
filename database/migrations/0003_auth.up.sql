-- Passwordless authentication. No password hash is ever stored, so there is
-- nothing to leak. Both magic-link tokens and session tokens live here only as
-- SHA-256 digests; the plaintext exists in the user's inbox or cookie alone.

CREATE TYPE auth_purpose AS ENUM ('login', 'email_change', 'admin_step_up');

CREATE TABLE magic_link_tokens (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
    email           citext NOT NULL,
    token_hash      bytea NOT NULL UNIQUE,
    purpose         auth_purpose NOT NULL DEFAULT 'login',
    expires_at      timestamptz NOT NULL,
    consumed_at     timestamptz,
    request_ip      inet,
    request_user_agent text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX magic_link_tokens_email_idx ON magic_link_tokens (email, created_at DESC);
CREATE INDEX magic_link_tokens_expiry_idx ON magic_link_tokens (expires_at)
    WHERE consumed_at IS NULL;

CREATE TABLE sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      bytea NOT NULL UNIQUE,
    -- Rotated on privilege change; an old cookie stops working immediately.
    generation      integer NOT NULL DEFAULT 1,
    ip              inet,
    user_agent      text,
    expires_at      timestamptz NOT NULL,
    revoked_at      timestamptz,
    last_used_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions (user_id, created_at DESC);
CREATE INDEX sessions_active_idx ON sessions (expires_at) WHERE revoked_at IS NULL;

-- Nonces for "sign in with Solana" style wallet proofs.
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

-- Append-only trail for anything a human did that affects another account.
CREATE TABLE audit_log (
    id              bigserial PRIMARY KEY,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,
    action          text NOT NULL,
    subject_type    text NOT NULL,
    subject_id      text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip              inet,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_actor_idx ON audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_subject_idx ON audit_log (subject_type, subject_id, created_at DESC);
