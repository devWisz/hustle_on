-- Reports, moderation decisions and in-app notifications.

CREATE TYPE report_reason AS ENUM (
    'spam', 'harassment', 'sexual_content', 'violence',
    'impersonation', 'stolen_work', 'illegal', 'other'
);
CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'actioned', 'dismissed');
CREATE TYPE moderation_action AS ENUM (
    'none', 'content_hidden', 'content_removed', 'user_warned',
    'user_suspended', 'user_banned'
);

CREATE TABLE reports (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    subject_type    text NOT NULL CHECK (subject_type IN ('video', 'comment', 'user', 'job')),
    subject_id      uuid NOT NULL,
    reason          report_reason NOT NULL,
    detail          text CHECK (length(detail) <= 2000),
    status          report_status NOT NULL DEFAULT 'open',
    resolved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
    resolution      moderation_action NOT NULL DEFAULT 'none',
    resolution_note text CHECK (length(resolution_note) <= 2000),
    resolved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_queue_idx ON reports (created_at) WHERE status IN ('open', 'reviewing');
CREATE INDEX reports_subject_idx ON reports (subject_type, subject_id);
-- One open report per person per subject keeps the queue from being flooded.
CREATE UNIQUE INDEX reports_unique_open_idx
    ON reports (reporter_id, subject_type, subject_id)
    WHERE status IN ('open', 'reviewing');

CREATE TYPE notification_kind AS ENUM (
    'new_sponsor', 'new_comment', 'comment_reply', 'new_follower',
    'application_update', 'engagement_update', 'moderation_notice', 'payout'
);

CREATE TABLE notifications (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind            notification_kind NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    read_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_unread_idx ON notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE TRIGGER reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
