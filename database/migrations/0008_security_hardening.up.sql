-- 0008: split the database's own privileges from the API's, and make the audit
-- trail tamper-evident.
--
-- Until now the API connected as the database owner. That role can drop tables,
-- rewrite history and grant itself anything, so a single injected statement — or
-- a bug in a query builder — would be enough to destroy creator records rather
-- than merely to read them.
--
-- This migration creates a NOLOGIN group role that has exactly the privileges
-- the API needs and no more, then leaves the owner for migrations. Creating the
-- group is inert: nothing changes until the API is pointed at a login role that
-- inherits it, which is a deliberate, separate step documented in
-- docs/database.md#application-role. Doing it that way means applying this
-- migration cannot lock a running deployment out of its own data.
--
-- The grants are deliberately written out table by table rather than as one
-- blanket GRANT, so the exceptions below are visible next to the rule.

-- 1. The group role. NOLOGIN: it is a container for privileges, never a
--    connection.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sardhana_app') THEN
        CREATE ROLE sardhana_app NOLOGIN;
    END IF;
END
$$;

COMMENT ON ROLE sardhana_app IS
    'Least-privilege privileges for the Sardhana API. Grant a LOGIN role INTO this one.';

-- 2. Read and write current data. The API is the only writer, and every table
--    in schema public is something it is meant to touch.
GRANT USAGE ON SCHEMA public TO sardhana_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sardhana_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sardhana_app;

-- 3. And the same for anything a later migration creates, so a new table does
--    not silently become unreadable to the API. This is recorded against the
--    role that runs migrations (the owner), which is why migrations must keep
--    being run as the owner.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sardhana_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO sardhana_app;

-- 4. The migration ledger belongs to the operator, not to the application. An
--    API that could rewrite schema_migrations could convince the next
--    deployment that a migration had already run.
REVOKE ALL ON TABLE schema_migrations FROM sardhana_app;

-- 5. Delete is narrower than write. Nothing in the API deletes an account, a
--    timelapse or a donation: creators withdraw (status becomes 'removed') and
--    the row stays, because donations and audit lines reference it. Revoking
--    DELETE means that even a statement injected through a bug cannot destroy
--    that history — the worst it can do is mark something removed, which is
--    visible and reversible.
REVOKE DELETE ON TABLE users, timelapses, donations FROM sardhana_app;

-- 6. The audit log is append-only for the API. Decisions may be added; they may
--    not be edited or erased, which is what makes the trail worth trusting when
--    it is read back during a dispute.
--
--    Nothing else loses a privilege it uses. Consuming a sign-in link UPDATEs
--    magic_link_tokens, consuming a wallet challenge UPDATEs wallet_challenges,
--    and withdrawing a "helpful" mark DELETEs from note_votes — all three are
--    narrow, intended writes, and revoking them would break sign-in and voting
--    rather than harden anything.
REVOKE UPDATE, DELETE ON TABLE audit_log FROM sardhana_app;

-- 7. PUBLIC has EXECUTE on every function by default, so this has to be said
--    explicitly rather than assumed.
--
--    recount_totals() rebuilds every cached counter and is an operator's repair
--    tool: nobody else should be able to call it.
--
--    purge_expired_auth(interval) is a different case — the API calls it at
--    start-up and then daily — so revoking it here without granting it back to
--    the application role would stop the scheduled purge. That grant is 0009,
--    because this migration had already been applied by the time the call site
--    was noticed, and an applied migration is not edited.
REVOKE EXECUTE ON FUNCTION recount_totals() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION purge_expired_auth(interval) FROM PUBLIC;

-- 8. Session-level guards, set on the role rather than in the connection string.
--    A pooled endpoint (Neon's PgBouncer, for one) does not reliably carry
--    startup parameters through to the backend, but a role setting is applied by
--    the server itself, on every connection, whoever opened it.
--
--    statement_timeout bounds a query that has gone wrong; lock_timeout stops a
--    request waiting forever behind a migration; the idle guard releases a
--    connection whose transaction was left open by a crashed request. All three
--    are values no correct API query should ever reach.
ALTER ROLE sardhana_app SET statement_timeout = '10s';
ALTER ROLE sardhana_app SET lock_timeout = '5s';
ALTER ROLE sardhana_app SET idle_in_transaction_session_timeout = '30s';
-- Pin the search path so a table created in another schema cannot shadow one of
-- ours, and drop the implicit "$user" schema from the path.
ALTER ROLE sardhana_app SET search_path = public, pg_catalog;

-- 9. A ceiling on connections, so a runaway process cannot occupy the pooler's
--    whole allowance and starve the database for everyone else.
ALTER ROLE sardhana_app CONNECTION LIMIT 40;

-- 10. Append-only is enforced by the database, not by convention. The revoke in
--     step 6 only binds roles that were granted the table; this binds everyone
--     including the owner, so an UPDATE or DELETE has to be a deliberate act
--     with the trigger turned off, and that act is itself visible in the WAL.
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: % is not permitted', TG_OP
        USING ERRCODE = 'restrict_violation',
              HINT = 'To prune or repair the trail deliberately: '
                     'ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only; '
                     '... ; ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only;';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
CREATE TRIGGER audit_log_append_only
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

-- No REVOKE of EXECUTE on the trigger function above: a trigger function cannot
-- be called directly at all, and revoking a privilege that the trigger machinery
-- might consult would risk breaking every audit insert for no gain.
