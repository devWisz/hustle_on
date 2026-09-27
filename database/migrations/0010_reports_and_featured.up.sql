-- 0010: reports that people file against sessions and notes, and featured
-- sessions an admin picks for the front page.

CREATE TYPE report_reason AS ENUM (
    'spam', 'not_their_work', 'misleading', 'inappropriate', 'harassment', 'other'
);
CREATE TYPE report_status AS ENUM ('open', 'resolved', 'dismissed');

CREATE TABLE reports (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id   uuid REFERENCES users(id) ON DELETE SET NULL,
    subject_type  text NOT NULL CHECK (subject_type IN ('timelapse', 'note')),
    timelapse_id  uuid NOT NULL REFERENCES timelapses(id) ON DELETE CASCADE,
    note_id       uuid REFERENCES timelapse_notes(id) ON DELETE CASCADE,
    reason        report_reason NOT NULL,
    details       text CHECK (length(details) <= 1000),
    status        report_status NOT NULL DEFAULT 'open',
    resolved_by   uuid REFERENCES users(id) ON DELETE SET NULL,
    resolved_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    CHECK ((subject_type = 'note') = (note_id IS NOT NULL)),
    CHECK ((status = 'open') = (resolved_at IS NULL))
);

-- One open report per person per thing, so a single account cannot flood the inbox.
CREATE UNIQUE INDEX reports_one_open_per_reporter
    ON reports (reporter_id, timelapse_id, COALESCE(note_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE status = 'open';
CREATE INDEX reports_open_idx ON reports (created_at DESC) WHERE status = 'open';
CREATE INDEX reports_timelapse_idx ON reports (timelapse_id);
CREATE INDEX reports_note_idx ON reports (note_id) WHERE note_id IS NOT NULL;
CREATE INDEX reports_reporter_idx ON reports (reporter_id) WHERE reporter_id IS NOT NULL;

-- Reports are a record of what was raised; the API resolves them, never erases them.
REVOKE DELETE ON TABLE reports FROM sardhana_app;

ALTER TABLE timelapses ADD COLUMN featured_at timestamptz;
CREATE INDEX timelapses_featured_idx ON timelapses (featured_at DESC)
    WHERE featured_at IS NOT NULL AND status = 'published';
