-- Threaded discussion, one level of nesting, with soft deletion so replies
-- attached to a removed parent stay readable.

CREATE TYPE comment_status AS ENUM ('visible', 'hidden', 'deleted');

CREATE TABLE comments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id        uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id       uuid REFERENCES comments(id) ON DELETE CASCADE,
    body            text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
    status          comment_status NOT NULL DEFAULT 'visible',
    like_count      integer NOT NULL DEFAULT 0 CHECK (like_count >= 0),
    reply_count     integer NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
    edited_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comments_video_idx ON comments (video_id, created_at DESC)
    WHERE parent_id IS NULL;
CREATE INDEX comments_parent_idx ON comments (parent_id, created_at);
CREATE INDEX comments_user_idx ON comments (user_id, created_at DESC);

CREATE TABLE comment_likes (
    comment_id      uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
