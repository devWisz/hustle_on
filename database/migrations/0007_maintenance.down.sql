-- Reverse 0007_maintenance.

DROP FUNCTION IF EXISTS purge_expired_auth(interval);
DROP FUNCTION IF EXISTS recount_totals();

DROP INDEX IF EXISTS audit_log_created_idx;
DROP INDEX IF EXISTS note_votes_user_idx;
DROP INDEX IF EXISTS bookmarks_timelapse_idx;
DROP INDEX IF EXISTS timelapse_views_viewer_idx;
DROP INDEX IF EXISTS magic_link_tokens_user_idx;
DROP INDEX IF EXISTS timelapses_reviewed_by_idx;
DROP INDEX IF EXISTS donations_donor_idx;
