-- Accounts, public profiles, linked social identities and wallets.

CREATE TYPE user_role AS ENUM ('member', 'moderator', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');

CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           citext NOT NULL UNIQUE,
    email_verified_at timestamptz,
    handle          citext NOT NULL UNIQUE
        CHECK (handle ~ '^[a-z0-9_]{3,30}$'),
    display_name    text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
    role            user_role NOT NULL DEFAULT 'member',
    status          user_status NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz
);

CREATE TABLE profiles (
    user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline        text CHECK (length(headline) <= 120),
    bio             text CHECK (length(bio) <= 2000),
    location        text CHECK (length(location) <= 80),
    avatar_url      text,
    banner_url      text,
    skills          text[] NOT NULL DEFAULT '{}',
    -- Hiring intent shown on the profile and used by discovery filters.
    open_to_work    boolean NOT NULL DEFAULT false,
    hourly_rate_usd numeric(10,2) CHECK (hourly_rate_usd >= 0),
    -- Denormalised counters, maintained by the API inside the write transaction.
    follower_count  integer NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
    video_count     integer NOT NULL DEFAULT 0 CHECK (video_count >= 0),
    sponsor_total_lamports bigint NOT NULL DEFAULT 0 CHECK (sponsor_total_lamports >= 0),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per linked external account. Verification is proof of control,
-- not merely a URL the user typed in.
CREATE TYPE social_platform AS ENUM ('x', 'github', 'youtube', 'linkedin', 'website');

CREATE TABLE social_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform        social_platform NOT NULL,
    username        text NOT NULL CHECK (length(username) BETWEEN 1 AND 100),
    url             text NOT NULL,
    verified_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, platform)
);

-- A wallet is only attached after an ed25519 signature over a server nonce.
CREATE TABLE wallets (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address         text NOT NULL UNIQUE CHECK (length(address) BETWEEN 32 AND 44),
    is_primary      boolean NOT NULL DEFAULT false,
    verified_at     timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX wallets_one_primary_per_user
    ON wallets (user_id) WHERE is_primary;

CREATE TABLE follows (
    follower_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id <> following_id)
);

CREATE INDEX follows_following_idx ON follows (following_id, created_at DESC);
CREATE INDEX users_handle_trgm_idx ON users USING gin (handle gin_trgm_ops);
CREATE INDEX profiles_open_to_work_idx ON profiles (open_to_work) WHERE open_to_work;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
