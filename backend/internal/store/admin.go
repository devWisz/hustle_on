package store

import (
	"context"

	"github.com/sardhana/backend/internal/domain"
)

// Members lists accounts for the admin console, most recently active first.
func (s *Store) Members(ctx context.Context, query string, limit int) ([]domain.AdminMember, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT u.id::text, u.handle::text, u.display_name, COALESCE(u.bio, ''), COALESCE(u.avatar_url, ''),
		       COALESCE(u.payout_address, ''), u.timelapse_count, u.donation_count, u.donation_total_lamports,
		       u.created_at, u.email::text, u.role::text, u.status::text, u.payout_verified_at IS NOT NULL,
		       (SELECT count(*) FROM timelapses t WHERE t.user_id = u.id AND t.status = 'in_review'),
		       (SELECT count(*) FROM timelapses t WHERE t.user_id = u.id AND t.status = 'rejected'),
		       GREATEST(u.last_seen_at,
		                (SELECT max(last_used_at) FROM sessions s WHERE s.user_id = u.id),
		                u.created_at)
		FROM users u
		WHERE $1::text IS NULL OR u.handle::text ILIKE $1 OR u.display_name ILIKE $1 OR u.email::text ILIKE $1
		ORDER BY 17 DESC
		LIMIT $2`, likePattern(query), limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.AdminMember{}
	for rows.Next() {
		var m domain.AdminMember
		if err := rows.Scan(&m.ID, &m.Handle, &m.DisplayName, &m.Bio, &m.AvatarURL,
			&m.PayoutAddress, &m.TimelapseCount, &m.DonationCount, &m.DonationTotal,
			&m.JoinedAt, &m.Email, &m.Role, &m.Status, &m.PayoutVerified,
			&m.InReview, &m.Rejected, &m.LastActiveAt); err != nil {
			return nil, normalize(err)
		}
		out = append(out, m)
	}
	return out, normalize(rows.Err())
}

// SetMemberStatus suspends or reinstates a member. Admin accounts are never
// matched, so one operator cannot lock another out through this path.
func (s *Store) SetMemberStatus(ctx context.Context, id, status string) (string, error) {
	var name string
	err := s.pool.QueryRow(ctx, `
		UPDATE users SET status = $2::user_status
		WHERE id = $1 AND role = 'member' AND status <> $2::user_status
		RETURNING display_name`, id, status).Scan(&name)
	return name, normalize(err)
}

// Ledger lists sponsorships across the platform, newest first.
func (s *Store) Ledger(ctx context.Context, status string, limit int) ([]domain.LedgerEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT d.id::text, d.amount_lamports, COALESCE(d.message, ''), d.status::text,
		       COALESCE(d.signature, ''), d.confirmed_at, d.created_at,
		       t.id::text, t.slug, t.title,
		       c.id::text, c.handle::text, c.display_name, COALESCE(c.avatar_url, ''),
		       dn.id::text, dn.handle::text, dn.display_name, COALESCE(dn.avatar_url, '')
		FROM donations d
		JOIN timelapses t ON t.id = d.timelapse_id
		JOIN users c ON c.id = d.creator_id
		LEFT JOIN users dn ON dn.id = d.donor_id
		WHERE $1 = '' OR d.status::text = $1
		ORDER BY d.created_at DESC
		LIMIT $2`, status, limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.LedgerEntry{}
	for rows.Next() {
		var (
			e                                        domain.LedgerEntry
			donorID, donorHandle, donorName, donorAv *string
		)
		if err := rows.Scan(&e.ID, &e.Amount, &e.Message, &e.Status, &e.Signature,
			&e.ConfirmedAt, &e.CreatedAt,
			&e.TimelapseID, &e.Timelapse.Slug, &e.Timelapse.Title,
			&e.Recipient.ID, &e.Recipient.Handle, &e.Recipient.DisplayName, &e.Recipient.AvatarURL,
			&donorID, &donorHandle, &donorName, &donorAv); err != nil {
			return nil, normalize(err)
		}
		if donorID != nil {
			e.Donor = &domain.Creator{ID: *donorID, Handle: deref(donorHandle), DisplayName: deref(donorName), AvatarURL: deref(donorAv)}
		}
		out = append(out, e)
	}
	return out, normalize(rows.Err())
}

// Activity returns one row per UTC day for the last `days` days: submissions
// received, review decisions taken, and confirmed sponsorship volume.
func (s *Store) Activity(ctx context.Context, days int) ([]domain.ActivityDay, error) {
	rows, err := s.pool.Query(ctx, `
		WITH d AS (
			SELECT generate_series(
				(now() AT TIME ZONE 'utc')::date - ($1::int - 1),
				(now() AT TIME ZONE 'utc')::date,
				interval '1 day')::date AS day
		)
		SELECT d.day::timestamptz,
		       (SELECT count(*) FROM timelapses t
		         WHERE (t.submitted_at AT TIME ZONE 'utc')::date = d.day),
		       (SELECT count(*) FROM audit_log a
		         WHERE a.action = 'timelapse.approve' AND (a.created_at AT TIME ZONE 'utc')::date = d.day),
		       (SELECT count(*) FROM audit_log a
		         WHERE a.action = 'timelapse.reject' AND (a.created_at AT TIME ZONE 'utc')::date = d.day),
		       (SELECT COALESCE(sum(amount_lamports), 0) FROM donations x
		         WHERE x.status = 'confirmed' AND (x.confirmed_at AT TIME ZONE 'utc')::date = d.day)
		FROM d ORDER BY d.day`, days)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []domain.ActivityDay{}
	for rows.Next() {
		var a domain.ActivityDay
		if err := rows.Scan(&a.Date, &a.Submitted, &a.Approved, &a.Rejected, &a.Lamports); err != nil {
			return nil, normalize(err)
		}
		out = append(out, a)
	}
	return out, normalize(rows.Err())
}
