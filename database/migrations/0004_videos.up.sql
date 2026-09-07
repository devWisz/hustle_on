-- Timelapse uploads: one row per work session published by a creator.

CREATE TYPE video_status AS ENUM (
    'draft',        -- row created, upload URL issued
    'uploaded',     -- bytes received, awaiting transcode
    'processing',
    'published',
    'failed',
    'removed'       -- taken down by the creator or a moderator
);

CREATE TYPE video_visibility AS ENUM ('public', 'unlisted', 'private');

CREATE TABLE videos (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug            text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{6,80}$'),
    title           text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
    description     text CHECK (length(description) <= 5000),
    status          video_status NOT NULL DEFAULT 'draft',
    visibility      video_visibility NOT NULL DEFAULT 'public',

    -- Source object in bucket storage; never served directly to viewers.
    storage_key     text,
    byte_size       bigint CHECK (byte_size >= 0),
    checksum_sha256 bytea,
    duration_seconds integer CHECK (duration_seconds >= 0),
    -- Real work time compressed into the timelapse, entered by the creator.
    session_minutes integer CHECK (session_minutes >= 0),
    width           integer,
    height          integer,
    thumbnail_url   text,
    playback_url    text,

    view_count      integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    comment_count   integer NOT NULL DEFAULT 0 CHECK (comment_count >= 0),
    sponsor_count   integer NOT NULL DEFAULT 0 CHECK (sponsor_count >= 0),
    sponsor_total_lamports bigint NOT NULL DEFAULT 0 CHECK (sponsor_total_lamports >= 0),

    published_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX videos_feed_idx ON videos (published_at DESC)
    WHERE status = 'published' AND visibility = 'public';
CREATE INDEX videos_user_idx ON videos (user_id, created_at DESC);
CREATE INDEX videos_title_trgm_idx ON videos USING gin (title gin_trgm_ops);

CREATE TABLE tags (
    id              serial PRIMARY KEY,
    name            citext NOT NULL UNIQUE CHECK (name ~ '^[a-z0-9+#.-]{2,30}$')
);

CREATE TABLE video_tags (
    video_id        uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    tag_id          integer NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (video_id, tag_id)
);

CREATE INDEX video_tags_tag_idx ON video_tags (tag_id);

-- Coarse view records, deduplicated per viewer per day by the API.
CREATE TABLE video_views (
    id              bigserial PRIMARY KEY,
    video_id        uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    viewer_id       uuid REFERENCES users(id) ON DELETE SET NULL,
    viewer_fingerprint bytea,
    watched_seconds integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX video_views_video_idx ON video_views (video_id, created_at DESC);

CREATE TRIGGER videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
