-- Search indexes, and the index the audit view needs.
--
-- The feed's search box matches a substring anywhere in the title, the summary
-- or the creator's name. A B-tree cannot serve `ILIKE '%term%'` — there is no
-- prefix to seek to — so before this migration every search was a sequential
-- scan of every published row plus the users table. Trigram indexes are what
-- make a leading-wildcard match an index lookup instead.
--
-- This is an index-only change: no table, column or constraint is touched, so
-- it is safe to apply while the API is serving.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- The feed query matches these four columns; each gets its own index so the
-- planner can pick whichever is most selective for a given term.
CREATE INDEX timelapses_title_trgm_idx
    ON timelapses USING gin (title gin_trgm_ops);

CREATE INDEX timelapses_summary_trgm_idx
    ON timelapses USING gin (summary gin_trgm_ops);

CREATE INDEX users_display_name_trgm_idx
    ON users USING gin (display_name gin_trgm_ops);

-- handle is citext, and the trigram operator class is defined for text, so the
-- index is built over an explicit text cast. The cast is immutable, which is
-- what lets it be indexed at all.
CREATE INDEX users_handle_trgm_idx
    ON users USING gin ((handle::text) gin_trgm_ops);

-- The admin activity view reads one operator's recent actions, newest first.
-- The existing index is keyed on the subject; this one is keyed on the actor.
CREATE INDEX audit_log_actor_idx ON audit_log (actor_id, created_at DESC);
