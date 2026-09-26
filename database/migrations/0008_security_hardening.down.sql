-- 0008, reversed.
--
-- This undoes the privilege split and the append-only trigger. It deliberately
-- does not try to undo the *effects* of either: no privileges are regranted to
-- anyone who did not have them before, because the grants this migration made
-- went to a role it also created. DROP OWNED removes those grants and any
-- objects the role came to own, which is what lets DROP ROLE succeed.

DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
DROP FUNCTION IF EXISTS audit_log_is_append_only();

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM sardhana_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE USAGE, SELECT ON SEQUENCES FROM sardhana_app;

GRANT EXECUTE ON FUNCTION recount_totals() TO PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_auth(interval) TO PUBLIC;

-- Removes every privilege granted to the role, and fails loudly if it owns
-- anything of its own rather than dropping it silently.
DROP OWNED BY sardhana_app;
DROP ROLE IF EXISTS sardhana_app;
