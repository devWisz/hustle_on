package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/sardhana/backend/internal/domain"
)

// This file holds the two things a viewer can leave behind: a note on somebody
// else's work, and a bookmark of it for themselves. Both are keyed on an
// account, so neither can be written by a signed-out visitor.

// --- peer notes -----------------------------------------------------------

// noteProjection is the shape every note read shares. The final column is the
// caller's own vote, resolved by the LEFT JOIN in noteQuery rather than by a
// second query per note.
const noteProjection = `n.id::text, n.body, n.timestamp_seconds, n.helpful_count,
	n.created_at, u.id::text, u.handle::text, u.display_name, COALESCE(u.avatar_url, ''),
	(v.user_id IS NOT NULL)`

// noteQuery is parameterised as ($1 timelapse id, $2 viewer id, $3 limit).
//
// An empty viewer id becomes NULL, so the join matches nothing and every note
// comes back with ViewerHasVoted false. That is exactly right for a signed-out
// reader: there is no vote to have cast.
const noteQuery = `SELECT ` + noteProjection + `
	FROM timelapse_notes n
	JOIN users u ON u.id = n.author_id
	LEFT JOIN note_votes v ON v.note_id = n.id AND v.user_id = NULLIF($2, '')::uuid
	WHERE n.timelapse_id = $1
	ORDER BY n.created_at DESC
	LIMIT $3`

func scanNote(row pgx.Row) (domain.Note, error) {
	var n domain.Note
	err := row.Scan(&n.ID, &n.Body, &n.TimestampSeconds, &n.HelpfulCount,
		&n.CreatedAt, &n.Author.ID, &n.Author.Handle, &n.Author.DisplayName,
		&n.Author.AvatarURL, &n.ViewerHasVoted)
	return n, err
}

// TimelapseNotes lists the notes on a timelapse, newest first.
func (s *Store) TimelapseNotes(ctx context.Context, timelapseID, viewerID string, limit int) ([]domain.Note, error) {
	rows, err := s.pool.Query(ctx, noteQuery, timelapseID, viewerID, limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.Note{}
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, normalize(err)
		}
		out = append(out, n)
	}
	return out, normalize(rows.Err())
}

// NoteByID returns a single note as the given viewer sees it.
func (s *Store) NoteByID(ctx context.Context, noteID, viewerID string) (domain.Note, error) {
	n, err := scanNote(s.pool.QueryRow(ctx, `
		SELECT `+noteProjection+`
		FROM timelapse_notes n
		JOIN users u ON u.id = n.author_id
		LEFT JOIN note_votes v ON v.note_id = n.id AND v.user_id = NULLIF($2, '')::uuid
		WHERE n.id = $1`, noteID, viewerID))
	return n, normalize(err)
}

// CreateNote writes a note and returns it as its author sees it.
//
// The published-only rule is enforced by a trigger on the table, so a note
// cannot be attached to a draft even if a caller reaches this method by some
// path that forgot to check.
func (s *Store) CreateNote(ctx context.Context, timelapseID, authorID, body string, timestamp *int) (domain.Note, error) {
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO timelapse_notes (timelapse_id, author_id, body, timestamp_seconds)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text`,
		timelapseID, authorID, body, timestamp).Scan(&id)
	if err != nil {
		return domain.Note{}, normalize(err)
	}
	return s.NoteByID(ctx, id, authorID)
}

// SetNoteVote records or withdraws the caller's "helpful" mark and returns the
// note's new total.
//
// The tally is maintained by a trigger on note_votes, so the count read back
// here is the same number any other reader will see, without this method
// having to do arithmetic that could drift from the rows.
func (s *Store) SetNoteVote(ctx context.Context, noteID, userID string, helpful bool) (int, error) {
	var count int
	err := s.tx(ctx, func(tx pgx.Tx) error {
		var err error
		if helpful {
			_, err = tx.Exec(ctx, `
				INSERT INTO note_votes (note_id, user_id) VALUES ($1, $2)
				ON CONFLICT DO NOTHING`, noteID, userID)
		} else {
			_, err = tx.Exec(ctx,
				`DELETE FROM note_votes WHERE note_id = $1 AND user_id = $2`, noteID, userID)
		}
		if err != nil {
			return normalize(err)
		}
		// A vote against a missing note must not look like a success, so the
		// total is read back inside the same transaction.
		return normalize(tx.QueryRow(ctx,
			`SELECT helpful_count FROM timelapse_notes WHERE id = $1`, noteID).Scan(&count))
	})
	if err != nil {
		return 0, err
	}
	return count, nil
}

// DeleteNote removes a note. The author may always delete their own; an admin
// may delete any, which is the moderation path.
func (s *Store) DeleteNote(ctx context.Context, noteID, userID string, asAdmin bool) error {
	tag, err := s.pool.Exec(ctx, `
		DELETE FROM timelapse_notes
		WHERE id = $1 AND ($3 OR author_id = $2)`, noteID, userID, asAdmin)
	if err != nil {
		return normalize(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// --- bookmarks ------------------------------------------------------------

// AddBookmark saves a published timelapse to a reader's list.
//
// Resolving the slug and inserting happen in one statement, so a slug that does
// not exist, or that has since been taken down, simply matches nothing and
// reports not-found rather than creating a row that points at unplayable work.
func (s *Store) AddBookmark(ctx context.Context, userID, slug string) error {
	tag, err := s.pool.Exec(ctx, `
		INSERT INTO bookmarks (user_id, timelapse_id)
		SELECT $1, t.id FROM timelapses t
		WHERE t.slug = $2 AND t.status = 'published'
		ON CONFLICT DO NOTHING`, userID, slug)
	if err != nil {
		return normalize(err)
	}
	// Zero rows means either the slug is unknown or it was already saved. Both
	// are the desired end state, so an unknown slug is the only case worth
	// distinguishing, and it is checked only when nothing was inserted.
	if tag.RowsAffected() == 0 {
		var exists bool
		if err := s.pool.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM bookmarks b JOIN timelapses t ON t.id = b.timelapse_id
			                WHERE b.user_id = $1 AND t.slug = $2 AND t.status = 'published')`,
			userID, slug).Scan(&exists); err != nil {
			return normalize(err)
		}
		if !exists {
			return ErrNotFound
		}
	}
	return nil
}

// RemoveBookmark unsaves a timelapse. Removing something that was never saved
// is not an error: the caller asked for it not to be on the list, and it is not.
func (s *Store) RemoveBookmark(ctx context.Context, userID, slug string) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM bookmarks b
		USING timelapses t
		WHERE b.timelapse_id = t.id AND b.user_id = $1 AND t.slug = $2`, userID, slug)
	return normalize(err)
}

// Bookmarks lists a reader's saved work, most recently saved first.
//
// The join reads the timelapse as it stands now rather than as it stood when it
// was saved, and skips anything no longer published, so a saved list can never
// offer a link to something that has been taken down.
func (s *Store) Bookmarks(ctx context.Context, userID string, limit int) ([]domain.Timelapse, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+timelapseColumns+`
		FROM bookmarks b
		JOIN timelapses t ON t.id = b.timelapse_id
		JOIN users u ON u.id = t.user_id
		WHERE b.user_id = $1 AND t.status = 'published'
		ORDER BY b.created_at DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, normalize(err)
	}
	return collectTimelapses(rows)
}

// --- audit trail ----------------------------------------------------------

// RecentAudit returns the most recent operator actions, newest first.
//
// This is the review panel's own record of itself. It is read only by an admin
// and is never part of a public payload.
func (s *Store) RecentAudit(ctx context.Context, limit int) ([]domain.AuditEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT a.id, a.action, a.subject_type, COALESCE(a.subject_id, ''),
		       a.metadata, a.created_at,
		       u.id::text, u.handle::text, u.display_name, COALESCE(u.avatar_url, '')
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.actor_id
		ORDER BY a.created_at DESC, a.id DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.AuditEntry{}
	for rows.Next() {
		var (
			e                                domain.AuditEntry
			actorID, handle, name, avatarURL *string
		)
		if err := rows.Scan(&e.ID, &e.Action, &e.SubjectType, &e.SubjectID,
			&e.Metadata, &e.CreatedAt,
			&actorID, &handle, &name, &avatarURL); err != nil {
			return nil, normalize(err)
		}
		// A deleted account leaves the decision standing but unattributed.
		if actorID != nil {
			e.Actor = &domain.Creator{
				ID:          *actorID,
				Handle:      deref(handle),
				DisplayName: deref(name),
				AvatarURL:   deref(avatarURL),
			}
		}
		out = append(out, e)
	}
	return out, normalize(rows.Err())
}
