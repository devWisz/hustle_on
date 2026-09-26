-- 0007: indexes for foreign keys that were missing one, and two maintenance
-- functions the operators can call by hand or from a scheduled job.

-- Foreign keys without an index make every delete of the parent row scan the
-- child table. These cover the ones the earlier migrations left out.
CREATE INDEX IF NOT EXISTS donations_donor_idx        ON donations (donor_id) WHERE donor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS timelapses_reviewed_by_idx ON timelapses (reviewed_by) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS magic_link_tokens_user_idx ON magic_link_tokens (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS timelapse_views_viewer_idx ON timelapse_views (viewer_id) WHERE viewer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookmarks_timelapse_idx    ON bookmarks (timelapse_id);
CREATE INDEX IF NOT EXISTS note_votes_user_idx        ON note_votes (user_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx      ON audit_log (created_at DESC);

-- Rebuilds every denormalised counter from the rows it summarises. The API
-- keeps these in step as it goes; this is the repair tool for when something
-- (a manual edit, a failed job) has let them drift.
CREATE OR REPLACE FUNCTION recount_totals() RETURNS void AS $$
BEGIN
    UPDATE timelapses t SET
        donation_count = (
            SELECT count(*) FROM donations d
             WHERE d.timelapse_id = t.id AND d.status = 'confirmed'),
        donation_total_lamports = (
            SELECT coalesce(sum(amount_lamports), 0) FROM donations d
             WHERE d.timelapse_id = t.id AND d.status = 'confirmed');

    UPDATE users u SET
        timelapse_count = (
            SELECT count(*) FROM timelapses t
             WHERE t.user_id = u.id AND t.status = 'published'),
        donation_count = (
            SELECT count(*) FROM donations d
             WHERE d.creator_id = u.id AND d.status = 'confirmed'),
        donation_total_lamports = (
            SELECT coalesce(sum(amount_lamports), 0) FROM donations d
             WHERE d.creator_id = u.id AND d.status = 'confirmed');
END;
$$ LANGUAGE plpgsql;

-- Deletes sign-in links, wallet challenges and sessions that can never be used
-- again. Nothing here is referenced by anything else, so deleting is safe.
CREATE OR REPLACE FUNCTION purge_expired_auth(keep interval DEFAULT interval '30 days')
RETURNS TABLE (links bigint, challenges bigint, sessions bigint) AS $$
DECLARE
    l bigint;
    c bigint;
    s bigint;
BEGIN
    DELETE FROM magic_link_tokens WHERE expires_at < now() - keep;
    GET DIAGNOSTICS l = ROW_COUNT;
    DELETE FROM wallet_challenges WHERE expires_at < now() - keep;
    GET DIAGNOSTICS c = ROW_COUNT;
    DELETE FROM sessions
     WHERE (expires_at < now() - keep) OR (revoked_at IS NOT NULL AND revoked_at < now() - keep);
    GET DIAGNOSTICS s = ROW_COUNT;
    RETURN QUERY SELECT l, c, s;
END;
$$ LANGUAGE plpgsql;
