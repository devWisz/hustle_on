-- Reverse 0005_engagement.
--
-- Dropping the tables takes their indexes and triggers with them; only the two
-- functions created for them outlive the drop and have to be removed by name.

DROP TABLE IF EXISTS note_votes;
DROP TABLE IF EXISTS timelapse_notes;
DROP TABLE IF EXISTS bookmarks;

DROP FUNCTION IF EXISTS note_vote_count();
DROP FUNCTION IF EXISTS notes_only_on_published();
