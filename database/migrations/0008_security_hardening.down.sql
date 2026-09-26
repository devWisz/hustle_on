-- 0008, reversed.
--
-- This undoes the privilege split and the append-only trigger. It deliberately
-- does not try to undo the *effects* of either: no privileges are regranted to
-- anyone who did not have them before, because every grant this migration made
-- went to a role it also created.
--
-- DROP OWNED BY is not used here even though it is the shorter spelling: it
-- requires privileges *of* the role being dropped, which the migration role does
-- not have over a role it merely created. Revoking the grants explicitly has the
-- same effect and works from the owner.

DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
DROP FUNCTION IF EXISTS audit_log_is_append_only();

-- Undo the defaults future tables would have inherited.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM sardhana_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE USAGE, SELECT ON SEQUENCES FROM sardhana_app;

-- Maintenance is a deliberate operator action again.
GRANT EXECUTE ON FUNCTION recount_totals() TO PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_auth(interval) TO PUBLIC;

-- Take back everything granted above. DROP ROLE refuses to run while the role
-- still holds any privilege, so this has to be exhaustive: tables, sequences,
-- functions and the schema itself.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM sardhana_app;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM sardhana_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM sardhana_app;
REVOKE ALL ON SCHEMA public FROM sardhana_app;

DROP ROLE IF EXISTS sardhana_app;
