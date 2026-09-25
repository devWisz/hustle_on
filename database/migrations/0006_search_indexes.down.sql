-- Reverse 0006_search_indexes.
--
-- The extension is dropped last, and without CASCADE on purpose: if anything
-- outside this migration has come to depend on pg_trgm, the rollback should
-- stop and say so rather than quietly remove a type another object is using.

DROP INDEX IF EXISTS audit_log_actor_idx;
DROP INDEX IF EXISTS users_handle_trgm_idx;
DROP INDEX IF EXISTS users_display_name_trgm_idx;
DROP INDEX IF EXISTS timelapses_summary_trgm_idx;
DROP INDEX IF EXISTS timelapses_title_trgm_idx;

DROP EXTENSION IF EXISTS pg_trgm;
