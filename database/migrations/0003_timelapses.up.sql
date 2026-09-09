-- Timelapses: one row per work session a creator publishes.
--
-- The status column is the whole lifecycle, and the order of the enum is the
-- order a submission actually moves through. Nothing reaches the public feed
-- without passing `published`, and only a review decision writes that value.

CREATE TYPE timelapse_status AS ENUM (
    'draft',        -- row created, upload URL issued, no bytes yet
    'uploaded',     -- bytes received, creator still editing the write-up
    'in_review',    -- submitted; waiting for an admin decision
    'published',    -- approved and publicly visible
    'rejected',     -- declined, with a reason the creator can read
    'removed'       -- withdrawn by the creator or taken down after publication
);

CREATE TABLE timelapses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug            text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{6,90}$'),

    title           text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
    -- What the creator actually did during the session. This is the substance
    -- of a submission, which is why a review cannot pass without it.
    summary         text NOT NULL CHECK (length(summary) BETWEEN 40 AND 4000),

    -- Where the work can be checked. Both optional, both stored as full URLs so
    -- a link never has to be reassembled at render time. The constraints pin
    -- them to the two hosts the product actually links to, so a stored value
    -- cannot become an open redirect to somewhere else.
    github_url      text CHECK (github_url ~ '^https://github\.com/[A-Za-z0-9._/-]{1,180}$'),
    x_url           text CHECK (x_url ~ '^https://(x|twitter)\.com/[A-Za-z0-9._/-]{1,180}$'),

    -- Media. The source object stays private; playback_url is what a viewer's
    -- player is pointed at.
    storage_key     text,
    byte_size       bigint CHECK (byte_size >= 0),
    duration_seconds integer CHECK (duration_seconds >= 0),
    -- Real time spent, as entered by the creator: a 40-second timelapse can
    -- represent an eight-hour session, and that is the number people donate to.
    session_minutes integer CHECK (session_minutes BETWEEN 0 AND 10080),
    thumbnail_url   text,
    playback_url    text,

    status          timelapse_status NOT NULL DEFAULT 'draft',

    -- The review decision, kept on the row it applies to so the creator's own
    -- dashboard can show it without reaching into the audit log.
    review_note     text CHECK (length(review_note) <= 500),
    reviewed_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     timestamptz,

    view_count      integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    donation_count  integer NOT NULL DEFAULT 0 CHECK (donation_count >= 0),
    donation_total_lamports bigint NOT NULL DEFAULT 0 CHECK (donation_total_lamports >= 0),

    submitted_at    timestamptz,
    published_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    -- A published row must carry both the moment it went live and playable
    -- media. Enforcing it here means no code path can produce a feed entry
    -- that renders as a broken player.
    CHECK (status <> 'published' OR (published_at IS NOT NULL AND playback_url IS NOT NULL)),
    -- A decision always has an author and a time; a rejection always has a
    -- reason, because "no" without one is not something a creator can act on.
    CHECK ((reviewed_at IS NULL) = (reviewed_by IS NULL)),
    CHECK (status <> 'rejected' OR (reviewed_at IS NOT NULL AND review_note IS NOT NULL))
);

-- The public feed. Partial, so it indexes only rows that can appear in it.
CREATE INDEX timelapses_feed_idx ON timelapses (published_at DESC)
    WHERE status = 'published';

-- The review queue, oldest first: the person who has waited longest is next.
CREATE INDEX timelapses_review_idx ON timelapses (submitted_at)
    WHERE status = 'in_review';

CREATE INDEX timelapses_user_idx ON timelapses (user_id, created_at DESC);

CREATE TRIGGER timelapses_updated_at BEFORE UPDATE ON timelapses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Coarse view records. Deduplicated per viewer per day by the API, so this
-- counts people rather than page refreshes.
CREATE TABLE timelapse_views (
    id              bigserial PRIMARY KEY,
    timelapse_id    uuid NOT NULL REFERENCES timelapses(id) ON DELETE CASCADE,
    viewer_id       uuid REFERENCES users(id) ON DELETE SET NULL,
    -- A salted digest of the caller's address for signed-out viewers. Storing
    -- the digest rather than the address keeps the dedupe working without
    -- keeping a log of who watched what.
    viewer_fingerprint bytea,
    viewed_on       date NOT NULL DEFAULT current_date,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per viewer per timelapse per day, enforced for both viewer kinds.
CREATE UNIQUE INDEX timelapse_views_user_daily_idx
    ON timelapse_views (timelapse_id, viewer_id, viewed_on)
    WHERE viewer_id IS NOT NULL;
CREATE UNIQUE INDEX timelapse_views_anon_daily_idx
    ON timelapse_views (timelapse_id, viewer_fingerprint, viewed_on)
    WHERE viewer_id IS NULL AND viewer_fingerprint IS NOT NULL;
