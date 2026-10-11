package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
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

// MaxFeatured is how many sessions the curated front page holds.
//
// A shelf is a selection, not a queue: past a dozen entries a visitor reads it as
// a second feed and the operator stops choosing. Featuring a thirteenth is
// refused rather than accepted and then not shown, because a cap that silently
// drops what it cannot display is worse than no cap at all.
const MaxFeatured = 12

// featuredOffset moves every position out of the way during a reorder. It is far
// larger than any real shelf, so offsetting cannot collide with a new rank.
const featuredOffset = 100000

// SetFeatured puts a published session on the curated front page, or takes it
// off.
//
// A newly featured session goes to the end of the shelf: the operator has said
// "this belongs here", not "this belongs first", and inserting at the top would
// silently rearrange work they had already placed. Positions are changed by
// ReorderFeatured, which is the operation that actually means "move this".
func (s *Store) SetFeatured(ctx context.Context, id string, featured bool, at time.Time) (string, error) {
	var title string
	err := s.tx(ctx, func(tx pgx.Tx) error {
		var status string
		var rank *int
		err := tx.QueryRow(ctx,
			`SELECT title, status::text, featured_rank FROM timelapses WHERE id = $1 FOR UPDATE`,
			id).Scan(&title, &status, &rank)
		if err != nil {
			return normalize(err)
		}
		if status != "published" {
			return ErrNotPublished
		}
		if !featured {
			_, err := tx.Exec(ctx,
				`UPDATE timelapses SET featured_at = NULL, featured_rank = NULL WHERE id = $1`, id)
			return normalize(err)
		}
		// Featuring something already on the shelf is not a move: leave its
		// position alone rather than jumping it to the end on a double-click.
		if rank != nil {
			return nil
		}
		var held int
		if err := tx.QueryRow(ctx,
			`SELECT count(*) FROM timelapses WHERE featured_rank IS NOT NULL`).Scan(&held); err != nil {
			return normalize(err)
		}
		if held >= MaxFeatured {
			return ErrShelfFull
		}
		_, err = tx.Exec(ctx, `
			UPDATE timelapses
			SET featured_at = $2,
			    featured_rank = (SELECT COALESCE(max(featured_rank), 0) + 1
			                       FROM timelapses WHERE featured_rank IS NOT NULL)
			WHERE id = $1`, id, at)
		return normalize(err)
	})
	if err != nil {
		return "", err
	}
	return title, nil
}

// Featured lists the curated front page in the order the operator arranged it.
func (s *Store) Featured(ctx context.Context, limit int) ([]domain.Timelapse, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+timelapseColumns+timelapseFrom+`
		WHERE t.status = 'published' AND t.featured_rank IS NOT NULL
		ORDER BY t.featured_rank ASC
		LIMIT $1`, limit)
	if err != nil {
		return nil, normalize(err)
	}
	return collectTimelapses(rows)
}

// ReorderFeatured rearranges the front page.
//
// ids must name exactly the sessions currently on the shelf — the same set, in
// the order they should appear. Requiring a permutation rather than accepting
// arbitrary ranks is what keeps membership and order separate operations: this
// one can only move what is already there, and the feature and unfeature
// endpoints are the only way in or out. That makes the common bug — a stale
// client reordering a shelf it last saw ten minutes ago — a rejection instead of
// a silent change to what the public sees.
func (s *Store) ReorderFeatured(ctx context.Context, ids []string) ([]string, error) {
	// The titles come back in the new order, so the audit line names what the
	// operator actually arranged rather than a list of ids nobody can read.
	titles := make([]string, 0, len(ids))
	err := s.tx(ctx, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx,
			`SELECT id::text, title FROM timelapses WHERE featured_rank IS NOT NULL ORDER BY featured_rank`)
		if err != nil {
			return normalize(err)
		}
		current := make(map[string]string, len(ids))
		for rows.Next() {
			var id, title string
			if err := rows.Scan(&id, &title); err != nil {
				rows.Close()
				return normalize(err)
			}
			current[id] = title
		}
		rows.Close()
		if err := normalize(rows.Err()); err != nil {
			return err
		}

		if len(ids) != len(current) {
			return fmt.Errorf("%w: the front page holds %d sessions, %d were named",
				ErrConflict, len(current), len(ids))
		}
		seen := make(map[string]bool, len(ids))
		for _, id := range ids {
			title, ok := current[id]
			if !ok {
				return fmt.Errorf("%w: %s is not on the front page", ErrConflict, id)
			}
			if seen[id] {
				return fmt.Errorf("%w: %s was named twice", ErrConflict, id)
			}
			seen[id] = true
			titles = append(titles, title)
		}

		if _, err := tx.Exec(ctx,
			`UPDATE timelapses SET featured_rank = featured_rank + $1 WHERE featured_rank IS NOT NULL`,
			featuredOffset); err != nil {
			return normalize(err)
		}
		ranks := make([]int32, len(ids))
		for i := range ids {
			ranks[i] = int32(i + 1)
		}
		_, err = tx.Exec(ctx, `
			UPDATE timelapses t SET featured_rank = v.rank
			FROM (SELECT id::uuid, rank FROM unnest($1::text[], $2::int[]) AS u(id, rank)) v
			WHERE t.id = v.id`, ids, ranks)
		return normalize(err)
	})
	if err != nil {
		return nil, err
	}
	return titles, nil
}

