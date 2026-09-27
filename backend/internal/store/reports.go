package store

import (
	"context"
	"time"

	"github.com/sardhana/backend/internal/domain"
)

// NewReport is what a member files.
type NewReport struct {
	ReporterID  string
	TimelapseID string
	NoteID      string
	Reason      string
	Details     string
}

// CreateReport files a report. A second open report from the same person about
// the same thing is a conflict, not a duplicate row.
func (s *Store) CreateReport(ctx context.Context, in NewReport) error {
	subject := "timelapse"
	if in.NoteID != "" {
		subject = "note"
	}
	tag, err := s.pool.Exec(ctx, `
		INSERT INTO reports (reporter_id, subject_type, timelapse_id, note_id, reason, details)
		SELECT $1, $2, $3, NULLIF($4, '')::uuid, $5::report_reason, NULLIF($6, '')
		WHERE $4 = '' OR EXISTS (
			SELECT 1 FROM timelapse_notes WHERE id = NULLIF($4, '')::uuid AND timelapse_id = $3
		)`,
		in.ReporterID, subject, in.TimelapseID, in.NoteID, in.Reason, in.Details)
	if err != nil {
		return normalize(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Reports lists reports with the session and note they point at, newest first.
func (s *Store) Reports(ctx context.Context, status string, limit int) ([]domain.Report, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT r.id::text, r.subject_type, r.reason::text, COALESCE(r.details, ''), r.status::text,
		       r.resolved_at, r.created_at,
		       rp.id::text, rp.handle::text, rp.display_name,
		       t.id::text, t.slug, t.title, t.status::text,
		       c.id::text, c.handle::text, c.display_name,
		       n.id::text, n.body, na.id::text, na.handle::text, na.display_name
		FROM reports r
		JOIN timelapses t ON t.id = r.timelapse_id
		JOIN users c ON c.id = t.user_id
		LEFT JOIN users rp ON rp.id = r.reporter_id
		LEFT JOIN timelapse_notes n ON n.id = r.note_id
		LEFT JOIN users na ON na.id = n.author_id
		WHERE $1 = '' OR r.status::text = $1
		ORDER BY (r.status = 'open') DESC, r.created_at DESC
		LIMIT $2`, status, limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.Report{}
	for rows.Next() {
		var (
			r                                        domain.Report
			rpID, rpHandle, rpName                   *string
			noteID, noteBody, naID, naHandle, naName *string
		)
		if err := rows.Scan(&r.ID, &r.SubjectType, &r.Reason, &r.Details, &r.Status,
			&r.ResolvedAt, &r.CreatedAt,
			&rpID, &rpHandle, &rpName,
			&r.Timelapse.ID, &r.Timelapse.Slug, &r.Timelapse.Title, &r.Timelapse.Status,
			&r.Timelapse.Creator.ID, &r.Timelapse.Creator.Handle, &r.Timelapse.Creator.DisplayName,
			&noteID, &noteBody, &naID, &naHandle, &naName); err != nil {
			return nil, normalize(err)
		}
		if rpID != nil {
			r.Reporter = &domain.Creator{ID: *rpID, Handle: deref(rpHandle), DisplayName: deref(rpName)}
		}
		if noteID != nil {
			r.Note = &domain.ReportNote{
				ID: *noteID, Body: deref(noteBody),
				Author: domain.Creator{ID: deref(naID), Handle: deref(naHandle), DisplayName: deref(naName)},
			}
		}
		out = append(out, r)
	}
	return out, normalize(rows.Err())
}

// ResolveReport closes an open report as resolved or dismissed.
func (s *Store) ResolveReport(ctx context.Context, id, adminID, status string, at time.Time) (string, error) {
	var title string
	err := s.pool.QueryRow(ctx, `
		UPDATE reports r SET status = $3::report_status, resolved_by = $2, resolved_at = $4
		FROM timelapses t
		WHERE r.id = $1 AND r.status = 'open' AND t.id = r.timelapse_id
		RETURNING t.title`, id, adminID, status, at).Scan(&title)
	return title, normalize(err)
}

// OpenReportCount is how many reports are waiting for a decision.
func (s *Store) OpenReportCount(ctx context.Context) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM reports WHERE status = 'open'`).Scan(&n)
	return n, normalize(err)
}

// SetFeatured features or unfeatures a published session.
func (s *Store) SetFeatured(ctx context.Context, id string, featured bool, at time.Time) (string, error) {
	var title string
	err := s.pool.QueryRow(ctx, `
		UPDATE timelapses SET featured_at = CASE WHEN $2 THEN $3 ELSE NULL END
		WHERE id = $1 AND status = 'published'
		RETURNING title`, id, featured, at).Scan(&title)
	return title, normalize(err)
}

// Featured lists the sessions an admin has featured, most recently featured first.
func (s *Store) Featured(ctx context.Context, limit int) ([]domain.Timelapse, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+timelapseColumns+timelapseFrom+`
		WHERE t.status = 'published' AND t.featured_at IS NOT NULL
		ORDER BY t.featured_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, normalize(err)
	}
	return collectTimelapses(rows)
}

// CreatorContact is who to email about a decision on a session.
type CreatorContact struct {
	Email       string
	DisplayName string
	Title       string
	Slug        string
}

// ContactForTimelapse returns the creator's address and the session's title.
func (s *Store) ContactForTimelapse(ctx context.Context, id string) (CreatorContact, error) {
	var c CreatorContact
	err := s.pool.QueryRow(ctx, `
		SELECT u.email::text, u.display_name, t.title, t.slug
		FROM timelapses t JOIN users u ON u.id = t.user_id
		WHERE t.id = $1`, id).Scan(&c.Email, &c.DisplayName, &c.Title, &c.Slug)
	return c, normalize(err)
}
