package store

import (
	"context"
	"time"

	"github.com/sardhana/backend/internal/domain"
)

// memberActivity is the expression the member list is ordered by: the most
// recent of the account's own last-seen stamp, its newest session, and its
// creation. It is a constant because it appears twice — in the ORDER BY and in
// the keyset predicate — and two copies of it that drifted apart would page
// incorrectly rather than fail loudly.
const memberActivity = `GREATEST(u.last_seen_at,
	(SELECT max(last_used_at) FROM sessions s WHERE s.user_id = u.id),
	u.created_at)`

// Members lists accounts for the admin console, most recently active first.
//
// The activity expression is never null — it falls back to created_at — so it
// is a usable sort key, and the id beside it makes the order total. Two accounts
// created in the same transaction otherwise have no defined order, and a page
// boundary between them would repeat or drop one.
func (s *Store) Members(ctx context.Context, query string, q PageQuery) (domain.Page[domain.AdminMember], error) {
	var before *time.Time
	var beforeID *string
	if parts, err := decodeKeyset(q.Cursor, 2); err != nil {
		return domain.Page[domain.AdminMember]{}, err
	} else if parts != nil {
		at, err := parseKeysetTime(parts[0])
		if err != nil {
			return domain.Page[domain.AdminMember]{}, err
		}
		before, beforeID = &at, &parts[1]
	}

	rows, err := s.pool.Query(ctx, `
		SELECT u.id::text, u.handle::text, u.display_name, COALESCE(u.bio, ''), COALESCE(u.avatar_url, ''),
		       COALESCE(u.payout_address, u.wallet_address::text, ''), u.timelapse_count, u.donation_count,
		       u.donation_total_lamports, u.created_at, COALESCE(u.wallet_address::text, ''),
		       COALESCE(u.email::text, ''), u.role::text, u.status::text,
		       (u.payout_verified_at IS NOT NULL OR u.wallet_address IS NOT NULL),
		       (SELECT count(*) FROM timelapses t WHERE t.user_id = u.id AND t.status = 'in_review'),
		       (SELECT count(*) FROM timelapses t WHERE t.user_id = u.id AND t.status = 'rejected'),
		       `+memberActivity+`
		FROM users u
		WHERE ($1::text IS NULL OR u.handle::text ILIKE $1 OR u.display_name ILIKE $1
		       OR u.wallet_address::text ILIKE $1 OR u.email::text ILIKE $1)
		  AND ($2::timestamptz IS NULL OR (`+memberActivity+`, u.id) < ($2, $3::uuid))
		ORDER BY `+memberActivity+` DESC, u.id DESC
		LIMIT $4`, likePattern(query), before, beforeID, q.Limit+1)
	if err != nil {
		return domain.Page[domain.AdminMember]{}, normalize(err)
	}
	defer rows.Close()

	out := []domain.AdminMember{}
	for rows.Next() {
		var m domain.AdminMember
		if err := rows.Scan(&m.ID, &m.Handle, &m.DisplayName, &m.Bio, &m.AvatarURL,
			&m.PayoutAddress, &m.TimelapseCount, &m.DonationCount, &m.DonationTotal,
			&m.JoinedAt, &m.WalletAddress, &m.Email, &m.Role, &m.Status, &m.PayoutVerified,
			&m.InReview, &m.Rejected, &m.LastActiveAt); err != nil {
			return domain.Page[domain.AdminMember]{}, normalize(err)
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return domain.Page[domain.AdminMember]{}, normalize(err)
	}
	return pageOf(out, q.Limit, func(m domain.AdminMember) string {
		return encodeKeyset(keysetTime(m.LastActiveAt), m.ID)
	}), nil
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
//
// The status filter and the cursor travel together, so a client paging a
// filtered ledger cannot accidentally resume against the unfiltered one: the
// filter is re-applied on every page.
func (s *Store) Ledger(ctx context.Context, status string, q PageQuery) (domain.Page[domain.LedgerEntry], error) {
	before, beforeID, err := decodeCursor(q.Cursor)
	if err != nil {
		return domain.Page[domain.LedgerEntry]{}, err
	}
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
		WHERE ($1 = '' OR d.status::text = $1)
		  AND ($2::timestamptz IS NULL OR (d.created_at, d.id) < ($2, $3::uuid))
		ORDER BY d.created_at DESC, d.id DESC
		LIMIT $4`, status, before, beforeID, q.Limit+1)
	if err != nil {
		return domain.Page[domain.LedgerEntry]{}, normalize(err)
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
			return domain.Page[domain.LedgerEntry]{}, normalize(err)
		}
		if donorID != nil {
			e.Donor = &domain.Creator{ID: *donorID, Handle: deref(donorHandle), DisplayName: deref(donorName), AvatarURL: deref(donorAv)}
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		return domain.Page[domain.LedgerEntry]{}, normalize(err)
	}
	return pageOf(out, q.Limit, func(e domain.LedgerEntry) string {
		return encodeKeyset(keysetTime(e.CreatedAt), e.ID)
	}), nil
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

// RecentNotes lists the newest notes across every session, for moderation.
//
// Paged on (created_at, id). Moderation is a list somebody works down, and the
// caps this used to have — a fixed 200 and no way past it — meant a busy site
// could hide a note simply by being busy.
func (s *Store) RecentNotes(ctx context.Context, q PageQuery) (domain.Page[domain.AdminNote], error) {
	before, beforeID, err := decodeCursor(q.Cursor)
	if err != nil {
		return domain.Page[domain.AdminNote]{}, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT n.id::text, n.body, n.timestamp_seconds, n.helpful_count, n.created_at,
		       u.id::text, u.handle::text, u.display_name, COALESCE(u.avatar_url, ''),
		       t.slug, t.title
		FROM timelapse_notes n
		JOIN users u ON u.id = n.author_id
		JOIN timelapses t ON t.id = n.timelapse_id
		WHERE ($1::timestamptz IS NULL OR (n.created_at, n.id) < ($1, $2::uuid))
		ORDER BY n.created_at DESC, n.id DESC
		LIMIT $3`, before, beforeID, q.Limit+1)
	if err != nil {
		return domain.Page[domain.AdminNote]{}, normalize(err)
	}
	defer rows.Close()

	out := []domain.AdminNote{}
	for rows.Next() {
		var n domain.AdminNote
		if err := rows.Scan(&n.ID, &n.Body, &n.TimestampSeconds, &n.HelpfulCount, &n.CreatedAt,
			&n.Author.ID, &n.Author.Handle, &n.Author.DisplayName, &n.Author.AvatarURL,
			&n.Timelapse.Slug, &n.Timelapse.Title); err != nil {
			return domain.Page[domain.AdminNote]{}, normalize(err)
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		return domain.Page[domain.AdminNote]{}, normalize(err)
	}
	return pageOf(out, q.Limit, func(n domain.AdminNote) string {
		return encodeKeyset(keysetTime(n.CreatedAt), n.ID)
	}), nil
}

// --- operator corrections -------------------------------------------------

// AdminEdit is the set of fields an operator may correct on somebody else's
// submission.
//
// It is deliberately not the creator's own TimelapseUpdate, because the two
// differ in one way that matters: here an absent field and an empty string are
// different instructions. A creator edits their own write-up and rarely needs to
// delete a link; an operator cleaning up a broken submission does, so an empty
// string clears the column and a nil pointer leaves it alone.
type AdminEdit struct {
	Title          *string
	Summary        *string
	GitHubURL      *string
	XURL           *string
	SessionMinutes *int
}

// AdminUpdateTimelapse corrects a submission in any state except withdrawn.
//
// There is no status predicate beyond that: an operator has to be able to fix a
// typo or a dead link on something already published, which is exactly the case
// the creator's own endpoint refuses by design. The handler validates the values
// and writes an audit line naming the fields it changed.
func (s *Store) AdminUpdateTimelapse(ctx context.Context, id string, up AdminEdit) (domain.Timelapse, error) {
	var updatedID string
	err := s.pool.QueryRow(ctx, `
		UPDATE timelapses SET
			title           = COALESCE($2::text, title),
			summary         = COALESCE($3::text, summary),
			github_url      = CASE WHEN $4::text IS NULL THEN github_url ELSE NULLIF($4, '') END,
			x_url           = CASE WHEN $5::text IS NULL THEN x_url ELSE NULLIF($5, '') END,
			session_minutes = COALESCE($6::int, session_minutes)
		WHERE id = $1 AND status <> 'removed'
		RETURNING id::text`,
		id, up.Title, up.Summary, up.GitHubURL, up.XURL, up.SessionMinutes).Scan(&updatedID)
	if err != nil {
		return domain.Timelapse{}, normalize(err)
	}
	return s.ByID(ctx, updatedID)
}

// SetThumbnail records the poster image for a submission. An empty reference
// clears it, which is how an operator undoes a wrong choice rather than being
// stuck with it.
func (s *Store) SetThumbnail(ctx context.Context, id, ref string) (string, error) {
	var title string
	err := s.pool.QueryRow(ctx, `
		UPDATE timelapses SET thumbnail_url = NULLIF($2, '')
		WHERE id = $1 AND status <> 'removed'
		RETURNING title`, id, ref).Scan(&title)
	return title, normalize(err)
}
