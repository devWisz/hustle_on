-- Reverse 0010_reports_and_featured.

DROP INDEX IF EXISTS timelapses_featured_idx;
ALTER TABLE timelapses DROP COLUMN IF EXISTS featured_at;

DROP TABLE IF EXISTS reports;
DROP TYPE IF EXISTS report_status;
DROP TYPE IF EXISTS report_reason;
