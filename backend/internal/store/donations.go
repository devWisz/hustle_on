package store

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/sardhana/backend/internal/domain"
)

// NewDonation is the intent recorded before the donor signs anything.
type NewDonation struct {
	TimelapseID   string
	CreatorID     string
	DonorID       string // empty when the donor is not signed in
	DonorAddress  string
	PayoutAddress string
	Amount        int64
	Message       string
	Cluster       string
}

// CreateDonation records the intent and returns its id.
//
// The intent exists before the transaction does so that the amount and the
// recipient are fixed by the server. When the signature comes back, it is
// checked against these values rather than against anything the client says.
func (s *Store) CreateDonation(ctx context.Context, in NewDonation) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO donations (timelapse_id, creator_id, donor_id, donor_address,
		                       payout_address, amount_lamports, message, cluster)
		VALUES ($1, $2, NULLIF($3,'')::uuid, $4, $5, $6, $7, $8)
		RETURNING id::text`,
		in.TimelapseID, in.CreatorID, in.DonorID, in.DonorAddress,
		in.PayoutAddress, in.Amount, nullText(in.Message), in.Cluster).Scan(&id)
	return id, normalize(err)
}

// PendingDonation is the intent as the confirmation step needs to see it.
type PendingDonation struct {
	ID            string
	TimelapseID   string
	CreatorID     string
	DonorAddress  string
	PayoutAddress string
	Amount        int64
	Status        string
}

// ClaimDonation attaches a signature to an intent and marks it submitted.
//
// The signature column is UNIQUE, so a transaction already recorded against
// another intent is rejected here rather than being credited a second time. The
// status predicate makes the claim single-shot: a confirmed row cannot be
// re-claimed with a different signature.
//
// Only the donor who recorded the intent can claim it: an intent belonging to
// someone else is reported as not found, so its existence is not disclosed.
func (s *Store) ClaimDonation(ctx context.Context, id, donorID, signature string) (PendingDonation, error) {
	var d PendingDonation
	err := s.pool.QueryRow(ctx, `
		UPDATE donations SET status = 'submitted', signature = $2
		WHERE id = $1 AND donor_id = $3 AND status IN ('pending', 'submitted')
		RETURNING id::text, timelapse_id::text, creator_id::text,
		          donor_address, payout_address, amount_lamports, status::text`,
		id, signature, donorID).Scan(&d.ID, &d.TimelapseID, &d.CreatorID,
		&d.DonorAddress, &d.PayoutAddress, &d.Amount, &d.Status)
	return d, normalize(err)
}

// ConfirmDonation credits a verified donation.
//
// chain_meta arrives as raw JSON bytes and is passed as text for the cast: sent
// as []byte the driver would make it a bytea, which jsonb will not accept.
//
// The counters on the timelapse and on the creator move in the same transaction
// as the status, and the status predicate means a repeated confirmation of the
// same row updates nothing: a retried request cannot double a total.
func (s *Store) ConfirmDonation(ctx context.Context, id string, slot int64, meta []byte, at time.Time) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		var timelapseID, creatorID string
		var amount int64
		err := tx.QueryRow(ctx, `
			UPDATE donations
			SET status = 'confirmed', confirmed_at = $2, slot = $3, chain_meta = $4::jsonb
			WHERE id = $1 AND status = 'submitted'
			RETURNING timelapse_id::text, creator_id::text, amount_lamports`,
			id, at, slot, string(meta)).Scan(&timelapseID, &creatorID, &amount)
		if err != nil {
			return normalize(err)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE timelapses
			SET donation_count = donation_count + 1,
			    donation_total_lamports = donation_total_lamports + $2
			WHERE id = $1`, timelapseID, amount); err != nil {
			return normalize(err)
		}
		_, err = tx.Exec(ctx, `
			UPDATE users
			SET donation_count = donation_count + 1,
			    donation_total_lamports = donation_total_lamports + $2
			WHERE id = $1`, creatorID, amount)
		return normalize(err)
	})
}

// FailDonation marks an intent that could not be verified.
func (s *Store) FailDonation(ctx context.Context, id string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE donations SET status = 'failed' WHERE id = $1 AND status <> 'confirmed'`, id)
	return normalize(err)
}

// UnsettledDonation is an intent the settle loop still has work to do on.
type UnsettledDonation struct {
	ID            string
	Signature     string
	DonorAddress  string
	PayoutAddress string
	Amount        int64
	CreatedAt     time.Time
}

// UnsettledDonations lists intents that are neither confirmed nor failed,
// oldest first.
func (s *Store) UnsettledDonations(ctx context.Context, limit int) ([]UnsettledDonation, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text, COALESCE(signature, ''), donor_address, payout_address,
		       amount_lamports, created_at
		FROM donations
		WHERE status IN ('pending', 'submitted')
		ORDER BY created_at ASC
		LIMIT $1`, limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []UnsettledDonation{}
	for rows.Next() {
		var d UnsettledDonation
		if err := rows.Scan(&d.ID, &d.Signature, &d.DonorAddress,
			&d.PayoutAddress, &d.Amount, &d.CreatedAt); err != nil {
			return nil, normalize(err)
		}
		out = append(out, d)
	}
	return out, normalize(rows.Err())
}

// TimelapseDonations lists the confirmed supporters under one timelapse,
// largest first.
//
// The cursor carries all three sort columns — amount, then confirmation time,
// then id — because the order is a three-level one. Ordering by amount alone
// would leave two equal gifts with no defined order, which is precisely the row
// pair a page boundary is most likely to fall between.
//
// confirmed_at IS NOT NULL is belt and braces: a confirmed row always has one,
// but a null in the sort key would make the row comparison null and drop the
// row from every page after the first.
func (s *Store) TimelapseDonations(ctx context.Context, timelapseID string, q PageQuery) (domain.Page[domain.Donation], error) {
	var beforeAmount *int64
	var beforeAt *time.Time
	var beforeID *string
	if parts, err := decodeKeyset(q.Cursor, 3); err != nil {
		return domain.Page[domain.Donation]{}, err
	} else if parts != nil {
		amount, err := parseKeysetInt(parts[0])
		if err != nil {
			return domain.Page[domain.Donation]{}, err
		}
		at, err := parseKeysetTime(parts[1])
		if err != nil {
			return domain.Page[domain.Donation]{}, err
		}
		beforeAmount, beforeAt, beforeID = &amount, &at, &parts[2]
	}

	rows, err := s.pool.Query(ctx, `
		SELECT d.id::text, d.amount_lamports, COALESCE(d.message, ''), d.status::text,
		       COALESCE(d.signature, ''), d.confirmed_at, d.created_at,
		       u.id::text, u.handle::text, u.display_name, COALESCE(u.avatar_url, '')
		FROM donations d
		LEFT JOIN users u ON u.id = d.donor_id
		WHERE d.timelapse_id = $1 AND d.status = 'confirmed' AND d.confirmed_at IS NOT NULL
		  AND ($2::bigint IS NULL
		       OR (d.amount_lamports, d.confirmed_at, d.id) < ($2, $3::timestamptz, $4::uuid))
		ORDER BY d.amount_lamports DESC, d.confirmed_at DESC, d.id DESC
		LIMIT $5`, timelapseID, beforeAmount, beforeAt, beforeID, q.Limit+1)
	if err != nil {
		return domain.Page[domain.Donation]{}, normalize(err)
	}
	items, err := collectDonations(rows)
	if err != nil {
		return domain.Page[domain.Donation]{}, err
	}
	return pageOf(items, q.Limit, func(d domain.Donation) string {
		if d.ConfirmedAt == nil {
			return ""
		}
		return encodeKeyset(keysetInt(d.Amount), keysetTime(*d.ConfirmedAt), d.ID)
	}), nil
}

// CreatorDonations lists what a creator has received across all their work,
// most recent first.
func (s *Store) CreatorDonations(ctx context.Context, creatorID string, q PageQuery) (domain.Page[domain.Donation], error) {
	before, beforeID, err := decodeCursor(q.Cursor)
	if err != nil {
		return domain.Page[domain.Donation]{}, err
	}
	rows, err := s.pool.Query(ctx, `
		SELECT d.id::text, d.amount_lamports, COALESCE(d.message, ''), d.status::text,
		       COALESCE(d.signature, ''), d.confirmed_at, d.created_at,
		       u.id::text, u.handle::text, u.display_name, COALESCE(u.avatar_url, '')
		FROM donations d
		LEFT JOIN users u ON u.id = d.donor_id
		WHERE d.creator_id = $1 AND d.status = 'confirmed' AND d.confirmed_at IS NOT NULL
		  AND ($2::timestamptz IS NULL OR (d.confirmed_at, d.id) < ($2, $3::uuid))
		ORDER BY d.confirmed_at DESC, d.id DESC
		LIMIT $4`, creatorID, before, beforeID, q.Limit+1)
	if err != nil {
		return domain.Page[domain.Donation]{}, normalize(err)
	}
	items, err := collectDonations(rows)
	if err != nil {
		return domain.Page[domain.Donation]{}, err
	}
	return pageOf(items, q.Limit, donationCursor), nil
}

// donationCursor packs the sort key of the confirmation-time lists: when the
// gift was confirmed, then its id to break ties between two confirmed in the
// same transaction.
func donationCursor(d domain.Donation) string {
	if d.ConfirmedAt == nil {
		return ""
	}
	return encodeKeyset(keysetTime(*d.ConfirmedAt), d.ID)
}

func collectDonations(rows pgx.Rows) ([]domain.Donation, error) {
	defer rows.Close()
	out := []domain.Donation{}
	for rows.Next() {
		var d domain.Donation
		// A donor who was not signed in leaves every joined column NULL, which
		// is why these are scanned through pointers and folded in afterwards.
		var id, handle, name, avatar *string
		if err := rows.Scan(&d.ID, &d.Amount, &d.Message, &d.Status, &d.Signature,
			&d.ConfirmedAt, &d.CreatedAt, &id, &handle, &name, &avatar); err != nil {
			return nil, normalize(err)
		}
		if id != nil {
			d.Donor = &domain.Creator{
				ID: *id, Handle: deref(handle), DisplayName: deref(name), AvatarURL: deref(avatar),
			}
		}
		out = append(out, d)
	}
	return out, normalize(rows.Err())
}
