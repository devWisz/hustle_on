package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/sardhana/backend/internal/domain"
)

// FileReport records a report. The partial unique index on open reports means
// a second report of the same subject by the same person is silently ignored.
func (s *Store) FileReport(ctx context.Context, reporterID, subjectType, subjectID, reason, detail string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO reports (reporter_id, subject_type, subject_id, reason, detail)
		VALUES (NULLIF($1,'')::uuid, $2, $3::uuid, $4::report_reason, $5)
		ON CONFLICT DO NOTHING`,
		reporterID, subjectType, subjectID, reason, nullText(detail))
	return normalize(err)
}

// ModerationQueue lists open reports, most-reported first.
func (s *Store) ModerationQueue(ctx context.Context, limit, offset int) ([]domain.Report, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT r.id::text, r.subject_type, r.subject_id::text, r.reason::text,
		       COALESCE(r.detail,''), r.status::text, r.created_at,
		       count(*) OVER (PARTITION BY r.subject_type, r.subject_id)::int,
		       COALESCE(u.id::text,''), COALESCE(u.handle::text,''), COALESCE(u.display_name,'')
		FROM reports r
		LEFT JOIN users u ON u.id = r.reporter_id
		WHERE r.status IN ('open','reviewing')
		ORDER BY r.created_at
		LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.Report{}
	for rows.Next() {
		var r domain.Report
		var c domain.Creator
		if err := rows.Scan(&r.ID, &r.SubjectType, &r.SubjectID, &r.Reason, &r.Detail,
			&r.Status, &r.CreatedAt, &r.ReportCount, &c.ID, &c.Handle, &c.DisplayName); err != nil {
			return nil, normalize(err)
		}
		if c.ID != "" {
			r.Reporter = &c
		}
		out = append(out, r)
	}
	return out, normalize(rows.Err())
}

// ResolveReport applies a moderator decision and enacts it in the same
// transaction, so a recorded decision and its effect cannot diverge.
func (s *Store) ResolveReport(ctx context.Context, reportID, moderatorID, action, note string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		var subjectType, subjectID string
		err := tx.QueryRow(ctx, `
			UPDATE reports
			SET status = CASE WHEN $3 = 'none' THEN 'dismissed'::report_status ELSE 'actioned'::report_status END,
			    resolution = $3::moderation_action,
			    resolution_note = $4,
			    resolved_by = $2,
			    resolved_at = now()
			WHERE id = $1 AND status IN ('open','reviewing')
			RETURNING subject_type, subject_id::text`,
			reportID, moderatorID, action, nullText(note)).Scan(&subjectType, &subjectID)
		if err != nil {
			return normalize(err)
		}

		switch action {
		case "content_hidden", "content_removed":
			switch subjectType {
			case "video":
				if _, err := tx.Exec(ctx,
					`UPDATE videos SET status = 'removed' WHERE id = $1`, subjectID); err != nil {
					return normalize(err)
				}
			case "comment":
				if _, err := tx.Exec(ctx,
					`UPDATE comments SET status = 'hidden' WHERE id = $1`, subjectID); err != nil {
					return normalize(err)
				}
			}
		case "user_suspended", "user_banned":
			if _, err := tx.Exec(ctx,
				`UPDATE users SET status = 'suspended' WHERE id = $1`, subjectID); err != nil {
				return normalize(err)
			}
			// A suspended account must lose its live sessions immediately;
			// leaving them valid would let the ban take effect only on expiry.
			if _, err := tx.Exec(ctx,
				`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
				subjectID); err != nil {
				return normalize(err)
			}
		}

		return s.writeAudit(ctx, tx, moderatorID, "report.resolve", subjectType, subjectID,
			map[string]any{"reportId": reportID, "action": action})
	})
}

// writeAudit appends to the audit log inside an existing transaction.
//
// The encoded JSON is passed as a string: a []byte parameter is sent as bytea,
// which Postgres will not cast to jsonb.
func (s *Store) writeAudit(ctx context.Context, tx pgx.Tx, actorID, action, subjectType, subjectID string, meta map[string]any) error {
	payload, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_log (actor_id, action, subject_type, subject_id, metadata)
		VALUES (NULLIF($1,'')::uuid, $2, $3, $4, $5::jsonb)`,
		actorID, action, subjectType, subjectID, string(payload))
	return normalize(err)
}

// Audit records an administrative action outside a wider transaction.
func (s *Store) Audit(ctx context.Context, actorID, action, subjectType, subjectID string, meta map[string]any) error {
	payload, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO audit_log (actor_id, action, subject_type, subject_id, metadata)
		VALUES (NULLIF($1,'')::uuid, $2, $3, $4, $5::jsonb)`,
		actorID, action, subjectType, subjectID, string(payload))
	return normalize(err)
}

// Notifications lists a user's notifications, newest first.
func (s *Store) Notifications(ctx context.Context, userID string, limit int) ([]domain.Notification, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, kind::text, payload, read_at, created_at
		FROM notifications WHERE user_id = $1
		ORDER BY created_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.Notification{}
	for rows.Next() {
		var n domain.Notification
		var raw []byte
		if err := rows.Scan(&n.ID, &n.Kind, &raw, &n.ReadAt, &n.CreatedAt); err != nil {
			return nil, normalize(err)
		}
		_ = json.Unmarshal(raw, &n.Payload)
		out = append(out, n)
	}
	return out, normalize(rows.Err())
}

func (s *Store) MarkNotificationsRead(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, userID)
	return normalize(err)
}

// PlatformStats is the admin dashboard summary.
type PlatformStats struct {
	Users            int   `json:"users"`
	PublishedVideos  int   `json:"publishedVideos"`
	OpenReports      int   `json:"openReports"`
	ConfirmedSponsor int   `json:"confirmedSponsorships"`
	SponsorLamports  int64 `json:"sponsorTotalLamports"`
	OpenJobs         int   `json:"openJobs"`
}

func (s *Store) Stats(ctx context.Context) (PlatformStats, error) {
	var st PlatformStats
	err := s.pool.QueryRow(ctx, `
		SELECT (SELECT count(*) FROM users WHERE status = 'active'),
		       (SELECT count(*) FROM videos WHERE status = 'published'),
		       (SELECT count(*) FROM reports WHERE status IN ('open','reviewing')),
		       (SELECT count(*) FROM sponsorships WHERE status = 'confirmed'),
		       (SELECT COALESCE(sum(amount),0) FROM sponsorships WHERE status = 'confirmed'),
		       (SELECT count(*) FROM jobs WHERE status = 'open')`).Scan(
		&st.Users, &st.PublishedVideos, &st.OpenReports,
		&st.ConfirmedSponsor, &st.SponsorLamports, &st.OpenJobs)
	return st, normalize(err)
}

func (s *Store) PublicStats(ctx context.Context) (domain.PublicStats, error) {
	var st domain.PublicStats
	err := s.pool.QueryRow(ctx, `
		SELECT (SELECT count(*) FROM users WHERE status = 'active'),
		       (SELECT count(*) FROM videos WHERE status = 'published'),
		       (SELECT count(*) FROM jobs WHERE status = 'open'),
		       (SELECT count(*) FROM sponsorships WHERE status = 'confirmed'),
		       (SELECT COALESCE(sum(amount),0) FROM sponsorships WHERE status = 'confirmed')`).Scan(
		&st.Users, &st.PublishedVideos, &st.OpenJobs, &st.ConfirmedSponsor, &st.SponsorLamports)
	return st, normalize(err)
}

func (s *Store) AdminUsers(ctx context.Context, search string, limit, offset int) ([]domain.AdminUser, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT u.id::text, u.handle::text, u.display_name, u.email::text,
		       u.role::text, u.status::text, p.video_count, p.open_to_work, u.created_at
		FROM users u
		JOIN profiles p ON p.user_id = u.id
		WHERE $1 = ''
		   OR u.handle ILIKE '%' || $1 || '%'
		   OR u.display_name ILIKE '%' || $1 || '%'
		   OR u.email ILIKE '%' || $1 || '%'
		ORDER BY u.created_at DESC
		LIMIT $2 OFFSET $3`, search, limit, offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()
	out := []domain.AdminUser{}
	for rows.Next() {
		var u domain.AdminUser
		if err := rows.Scan(&u.ID, &u.Handle, &u.DisplayName, &u.Email,
			&u.Role, &u.Status, &u.VideoCount, &u.OpenToWork, &u.CreatedAt); err != nil {
			return nil, normalize(err)
		}
		out = append(out, u)
	}
	return out, normalize(rows.Err())
}

func (s *Store) AdminVideos(ctx context.Context, search string, limit, offset int) ([]domain.Video, error) {
	rows, err := s.pool.Query(ctx, videoSelect+`
		WHERE ($1 = '' OR v.title ILIKE '%' || $1 || '%' OR u.handle ILIKE '%' || $1 || '%')
		ORDER BY v.created_at DESC
		LIMIT $2 OFFSET $3`, search, limit, offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()
	return collectVideos(rows)
}

func (s *Store) AdminJobs(ctx context.Context, search string, limit, offset int) ([]domain.Job, error) {
	rows, err := s.pool.Query(ctx, jobSelect+`
		WHERE ($1 = '' OR j.title ILIKE '%' || $1 || '%' OR u.handle ILIKE '%' || $1 || '%')
		ORDER BY j.created_at DESC
		LIMIT $2 OFFSET $3`, search, limit, offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()
	out := []domain.Job{}
	for rows.Next() {
		j, err := scanJob(rows)
		if err != nil {
			return nil, normalize(err)
		}
		out = append(out, j)
	}
	return out, normalize(rows.Err())
}
