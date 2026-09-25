-- Engagement: saved lists and peer notes.
--
-- Both tables belong to a signed-in account. A guest preview renders sample
-- records on the client and never writes here, which is what keeps invented
-- data out of the database entirely.

-- ---------------------------------------------------------------------------
-- Bookmarks
-- ---------------------------------------------------------------------------
-- A saved list is a join row, not a copied snapshot of the timelapse. Copying
-- the title and thumbnails into the bookmark would mean a creator who corrects
-- a typo, or has their work taken down, still appears unchanged on every list
-- that saved it.
CREATE TABLE bookmarks (
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timelapse_id    uuid NOT NULL REFERENCES timelapses(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),

    -- Saving the same thing twice is not a state the product has, so the
    -- primary key is what makes the toggle idempotent rather than a check the
    -- API has to remember to perform.
    PRIMARY KEY (user_id, timelapse_id)
);

-- The saved list, newest first.
CREATE INDEX bookmarks_user_idx ON bookmarks (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Peer notes
-- ---------------------------------------------------------------------------
-- A note is a technical observation a viewer leaves against a timelapse, at an
-- optional point on the timeline. It is the only place a viewer's own words are
-- stored, so the length bound is enforced here rather than trusted from the API.
CREATE TABLE timelapse_notes (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    timelapse_id        uuid NOT NULL REFERENCES timelapses(id) ON DELETE CASCADE,
    -- Deleting an account takes its notes with it; a note is authored speech,
    -- and leaving it behind attributed to nobody would misrepresent the thread.
    author_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    body                text NOT NULL
        CHECK (length(btrim(body)) BETWEEN 2 AND 2000),

    -- Where in the video the observation applies. NULL means the note is about
    -- the work as a whole; zero is a legitimate timestamp, which is why this is
    -- nullable rather than defaulted.
    timestamp_seconds   integer CHECK (timestamp_seconds IS NULL
                                       OR timestamp_seconds BETWEEN 0 AND 86400),

    -- Denormalised, and maintained by the trigger below rather than by the API,
    -- so a vote written by any path is still counted exactly once.
    helpful_count       integer NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- The thread under a timelapse.
CREATE INDEX timelapse_notes_timelapse_idx ON timelapse_notes (timelapse_id, created_at DESC);
-- "Notes I have written", for the author's own view and for moderation.
CREATE INDEX timelapse_notes_author_idx ON timelapse_notes (author_id, created_at DESC);

-- Only an edit to the note's content moves updated_at. The vote trigger below
-- issues an UPDATE on this table, and a note should not read as edited because
-- somebody found it helpful.
CREATE TRIGGER timelapse_notes_updated_at BEFORE UPDATE ON timelapse_notes
    FOR EACH ROW
    WHEN (OLD.body IS DISTINCT FROM NEW.body
          OR OLD.timestamp_seconds IS DISTINCT FROM NEW.timestamp_seconds)
    EXECUTE FUNCTION set_updated_at();

-- A note may only be attached to work the public can actually see. Without
-- this, the notes endpoint would be a way to attach text to a draft the author
-- has not published, or to something that has since been taken down.
CREATE OR REPLACE FUNCTION notes_only_on_published() RETURNS trigger AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM timelapses WHERE id = NEW.timelapse_id AND status = 'published'
    ) THEN
        RAISE EXCEPTION 'a note may only be attached to a published timelapse'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER timelapse_notes_published_only BEFORE INSERT ON timelapse_notes
    FOR EACH ROW EXECUTE FUNCTION notes_only_on_published();

-- ---------------------------------------------------------------------------
-- Note votes
-- ---------------------------------------------------------------------------
-- "Helpful" is a single, unweighted mark. One row per voter per note is the
-- whole tally, so the count cannot be inflated by voting twice.
CREATE TABLE note_votes (
    note_id     uuid NOT NULL REFERENCES timelapse_notes(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (note_id, user_id)
);

-- Counting the voters for one note.
CREATE INDEX note_votes_note_idx ON note_votes (note_id);

-- Keep helpful_count derived from the votes themselves, so the two can never
-- disagree no matter which path wrote the vote.
CREATE OR REPLACE FUNCTION note_vote_count() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE timelapse_notes
        SET helpful_count = helpful_count + 1
        WHERE id = NEW.note_id;
    ELSE
        UPDATE timelapse_notes
        SET helpful_count = greatest(helpful_count - 1, 0)
        WHERE id = OLD.note_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER note_votes_count AFTER INSERT OR DELETE ON note_votes
    FOR EACH ROW EXECUTE FUNCTION note_vote_count();
