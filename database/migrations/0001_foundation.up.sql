-- Foundation: extensions, the shared updated_at trigger, and accounts.
--
-- The platform has exactly one kind of account. A member uploads timelapses and
-- receives donations; an admin additionally reviews the queue. There is no
-- separate creator record, because every account is a potential creator and a
-- second table would only ever hold the same primary key.

CREATE EXTENSION IF NOT EXISTS citext;

-- Every mutable table carries updated_at, maintained here rather than by the
-- application, so a write that bypasses the API cannot leave a stale timestamp.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE user_role AS ENUM ('member', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended');

CREATE TABLE users (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity. Email is the login credential; handle is the public name.
    email             citext NOT NULL UNIQUE,
    email_verified_at timestamptz,
    handle            citext NOT NULL UNIQUE
        CHECK (handle ~ '^[a-z0-9_]{3,30}$'),
    display_name      text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),

    role              user_role NOT NULL DEFAULT 'member',
    status            user_status NOT NULL DEFAULT 'active',

    -- Public profile. Kept on the account row: at this scale a `profiles` table
    -- would share the same primary key and be joined on every single read.
    bio               text CHECK (length(bio) <= 600),
    avatar_url        text,

    -- Where donations are sent. Only written after the account has signed a
    -- server-issued nonce with the matching key, so the address on file is
    -- always one the account has proven it controls.
    payout_address    text UNIQUE CHECK (length(payout_address) BETWEEN 32 AND 44),
    payout_verified_at timestamptz,

    -- Denormalised totals, maintained by the API inside the same transaction as
    -- the write that changes them. They exist so a profile or a card never has
    -- to aggregate the donations table.
    timelapse_count   integer NOT NULL DEFAULT 0 CHECK (timelapse_count >= 0),
    donation_count    integer NOT NULL DEFAULT 0 CHECK (donation_count >= 0),
    donation_total_lamports bigint NOT NULL DEFAULT 0 CHECK (donation_total_lamports >= 0),

    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    last_seen_at      timestamptz,

    -- An address may only be recorded together with the proof that verified it.
    CHECK ((payout_address IS NULL) = (payout_verified_at IS NULL))
);

-- The admin queue reads this to find operators; it is a handful of rows.
CREATE INDEX users_admin_idx ON users (created_at DESC) WHERE role = 'admin';

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
