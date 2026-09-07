package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/sardhana/backend/internal/domain"
)

// NewSponsorship is a sponsorship the client intends to send on chain.
type NewSponsorship struct {
	SponsorID   string
	CreatorID   string
	VideoID     string
	Amount      int64
	Mint        string
	Message     string
	IsAnonymous bool
}

// CreateSponsorshipIntent records the intent before the transaction is sent.
// Nothing is counted as earned here: the row stays 'pending' until the chain
// confirms it, so a client that never signs leaves no trace on any total.
func (s *Store) CreateSponsorshipIntent(ctx context.Context, in NewSponsorship) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO sponsorships (sponsor_id, creator_id, video_id, amount, mint, message, is_anonymous)
		VALUES (NULLIF($1,'')::uuid, $2, NULLIF($3,'')::uuid, $4, $5, $6, $7)
		RETURNING id::text`,
		in.SponsorID, in.CreatorID, in.VideoID, in.Amount,
		nullText(in.Mint), nullText(in.Message), in.IsAnonymous).Scan(&id)
	return id, normalize(err)
}

// AttachSignature links a submitted transaction signature to an intent.
func (s *Store) AttachSignature(ctx context.Context, sponsorshipID, sponsorID, signature, cluster, payer, payee string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		var amount int64
		var mint *string
		err := tx.QueryRow(ctx, `
			SELECT amount, mint FROM sponsorships
			WHERE id = $1
			  AND status = 'pending'
			  AND (sponsor_id = NULLIF($2,'')::uuid OR (sponsor_id IS NULL AND $2 = ''))`,
			sponsorshipID, sponsorID).Scan(&amount, &mint)
		if err != nil {
			return normalize(err)
		}

		var txID string
		if err := tx.QueryRow(ctx, `
			INSERT INTO onchain_transactions
				(signature, kind, cluster, payer_address, payee_address, mint, amount, status)
			VALUES ($1, 'sponsorship', $2, $3, $4, $5, $6, 'submitted')
			ON CONFLICT (signature) DO NOTHING
			RETURNING id::text`,
			signature, cluster, payer, payee, mint, amount).Scan(&txID); err != nil {
			// A signature already on file cannot be reused for a second intent.
			return normalize(err)
		}

		_, err = tx.Exec(ctx, `
			UPDATE sponsorships SET status = 'submitted', transaction_id = $2::uuid
			WHERE id = $1`, sponsorshipID, txID)
		return normalize(err)
	})
}

// ConfirmSponsorship promotes a verified transaction and moves the totals.
// Counters are only ever advanced here, after the RPC has confirmed the
// transfer, and the WHERE clause makes a repeated confirmation a no-op.
func (s *Store) ConfirmSponsorship(ctx context.Context, signature string, slot int64, feeAmount int64, raw []byte) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		var txID string
		err := tx.QueryRow(ctx, `
			UPDATE onchain_transactions
			SET status = 'confirmed', slot = $2, fee_amount = $3,
			    raw_meta = $4::jsonb, confirmed_at = now()
			WHERE signature = $1 AND status <> 'confirmed'
			RETURNING id::text`, signature, slot, feeAmount, raw).Scan(&txID)
		if err != nil {
			return normalize(err)
		}

		var sponsorshipID, creatorID string
		var videoID *string
		var amount int64
		err = tx.QueryRow(ctx, `
			UPDATE sponsorships SET status = 'confirmed'
			WHERE transaction_id = $1::uuid AND status <> 'confirmed'
			RETURNING id::text, creator_id::text, video_id::text, amount`,
			txID).Scan(&sponsorshipID, &creatorID, &videoID, &amount)
		if err != nil {
			return normalize(err)
		}

		if _, err := tx.Exec(ctx, `
			UPDATE profiles SET sponsor_total_lamports = sponsor_total_lamports + $2
			WHERE user_id = $1`, creatorID, amount); err != nil {
			return normalize(err)
		}
		if videoID != nil && *videoID != "" {
			if _, err := tx.Exec(ctx, `
				UPDATE videos SET sponsor_count = sponsor_count + 1,
				                  sponsor_total_lamports = sponsor_total_lamports + $2
				WHERE id = $1`, *videoID, amount); err != nil {
				return normalize(err)
			}
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO notifications (user_id, kind, payload)
			VALUES ($1, 'new_sponsor', jsonb_build_object('sponsorshipId', $2::text, 'amount', $3::bigint))`,
			creatorID, sponsorshipID, amount)
		return normalize(err)
	})
}

// FailSponsorship marks an intent dead after the chain rejected it or the
// verification window elapsed.
func (s *Store) FailSponsorship(ctx context.Context, signature string) error {
	return s.tx(ctx, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx,
			`UPDATE onchain_transactions SET status = 'failed' WHERE signature = $1 AND status <> 'confirmed'`,
			signature); err != nil {
			return normalize(err)
		}
		_, err := tx.Exec(ctx, `
			UPDATE sponsorships SET status = 'failed'
			WHERE transaction_id = (SELECT id FROM onchain_transactions WHERE signature = $1)
			  AND status <> 'confirmed'`, signature)
		return normalize(err)
	})
}

const sponsorshipSelect = `
	SELECT s.id::text, s.amount, COALESCE(s.mint,''), COALESCE(s.message,''), s.status::text,
	       COALESCE(t.signature,''), s.is_anonymous, COALESCE(s.video_id::text,''), s.created_at,
	       COALESCE(u.id::text,''), COALESCE(u.handle::text,''), COALESCE(u.display_name,''),
	       COALESCE(p.avatar_url,'')
	FROM sponsorships s
	LEFT JOIN onchain_transactions t ON t.id = s.transaction_id
	LEFT JOIN users u ON u.id = s.sponsor_id
	LEFT JOIN profiles p ON p.user_id = u.id`

func collectSponsorships(rows pgx.Rows) ([]domain.Sponsorship, error) {
	out := []domain.Sponsorship{}
	for rows.Next() {
		var s domain.Sponsorship
		var c domain.Creator
		if err := rows.Scan(&s.ID, &s.Amount, &s.Mint, &s.Message, &s.Status,
			&s.Signature, &s.IsAnonymous, &s.VideoID, &s.CreatedAt,
			&c.ID, &c.Handle, &c.DisplayName, &c.AvatarURL); err != nil {
			return nil, normalize(err)
		}
		// An anonymous sponsor is stripped here, in the layer that reads the
		// row, so no handler can leak the identity by forgetting to check.
		if !s.IsAnonymous && c.ID != "" {
			s.Sponsor = &c
		}
		out = append(out, s)
	}
	return out, normalize(rows.Err())
}

func (s *Store) SponsorshipsForCreator(ctx context.Context, creatorID string, limit, offset int) ([]domain.Sponsorship, error) {
	rows, err := s.pool.Query(ctx, sponsorshipSelect+`
		WHERE s.creator_id = $1 AND s.status = 'confirmed'
		ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`, creatorID, limit, offset)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()
	return collectSponsorships(rows)
}

func (s *Store) SponsorshipsForVideo(ctx context.Context, videoID string, limit int) ([]domain.Sponsorship, error) {
	rows, err := s.pool.Query(ctx, sponsorshipSelect+`
		WHERE s.video_id = $1 AND s.status = 'confirmed'
		ORDER BY s.amount DESC, s.created_at DESC LIMIT $2`, videoID, limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()
	return collectSponsorships(rows)
}

// PendingSignature is a submitted transaction awaiting confirmation.
type PendingSignature struct {
	Signature string
	Kind      string
}

// PendingSignatures feeds the reconciler that polls the chain for outcomes.
func (s *Store) PendingSignatures(ctx context.Context, limit int) ([]PendingSignature, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT signature, kind::text FROM onchain_transactions
		WHERE status = 'submitted' AND created_at > now() - interval '24 hours'
		ORDER BY created_at LIMIT $1`, limit)
	if err != nil {
		return nil, normalize(err)
	}
	defer rows.Close()

	out := []PendingSignature{}
	for rows.Next() {
		var p PendingSignature
		if err := rows.Scan(&p.Signature, &p.Kind); err != nil {
			return nil, normalize(err)
		}
		out = append(out, p)
	}
	return out, normalize(rows.Err())
}

// CreatorPayoutAddress returns the wallet a sponsorship must be sent to.
func (s *Store) CreatorPayoutAddress(ctx context.Context, creatorID string) (string, error) {
	var addr string
	err := s.pool.QueryRow(ctx,
		`SELECT address FROM wallets WHERE user_id = $1 AND is_primary LIMIT 1`, creatorID).Scan(&addr)
	return addr, normalize(err)
}
