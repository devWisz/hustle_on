package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sardhana/backend/internal/domain"
)

// profileColumns is the projection behind every profile read. It is a single
// constant so the public and self shapes can never drift apart in what they
// select — only in what they are allowed to expose.
//
// PayoutAddress resolves to the login wallet when no separate payout address has
// been set, so there is exactly one answer to "where does money for this creator
// go" and every caller gets it from the same place. A donor reading this field
// does not need to know which of the two columns supplied it.
const profileColumns = `u.id::text, u.handle::text, u.display_name,
	COALESCE(u.bio, ''), COALESCE(u.avatar_url, ''), COALESCE(u.payout_address, u.wallet_address::text, ''),
	u.timelapse_count, u.donation_count, u.donation_total_lamports, u.created_at`

func scanProfile(row interface{ Scan(...any) error }) (domain.PublicUser, error) {
	var u domain.PublicUser
	err := row.Scan(&u.ID, &u.Handle, &u.DisplayName, &u.Bio, &u.AvatarURL,
		&u.PayoutAddress, &u.TimelapseCount, &u.DonationCount, &u.DonationTotal, &u.JoinedAt)
	return u, err
}

// PublicProfile returns a creator's profile by handle. Suspended accounts are
// excluded here rather than filtered by the caller, so no handler can leak one
// by forgetting the check.
func (s *Store) PublicProfile(ctx context.Context, handle string) (domain.PublicUser, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+profileColumns+` FROM users u WHERE u.handle = $1 AND u.status = 'active'`, handle)
	u, err := scanProfile(row)
	return u, normalize(err)
}

// SelfProfile returns the signed-in account's own view of itself.
func (s *Store) SelfProfile(ctx context.Context, userID string) (domain.SelfUser, error) {
	var self domain.SelfUser
	var payoutVerified *time.Time
	var onboardedAt *time.Time
	var payoutAddress *string
	err := s.pool.QueryRow(ctx, `
		SELECT `+profileColumns+`, COALESCE(u.wallet_address::text, ''), COALESCE(u.email::text, ''),
		       u.role::text, u.payout_address, u.payout_verified_at, u.onboarded_at
		FROM users u WHERE u.id = $1`, userID).Scan(
		&self.ID, &self.Handle, &self.DisplayName, &self.Bio, &self.AvatarURL,
		&self.PayoutAddress, &self.TimelapseCount, &self.DonationCount, &self.DonationTotal,
		&self.JoinedAt, &self.WalletAddress, &self.Email, &self.Role,
		&payoutAddress, &payoutVerified, &onboardedAt)
	if err != nil {
		return domain.SelfUser{}, normalize(err)
	}
	// Signing in with a wallet already proved control of it, so an account whose
	// payout is its own login address counts as verified even though no separate
	// payout challenge was ever run. Only an account that has never had either
	// is unverified.
	self.PayoutVerified = payoutVerified != nil || self.WalletAddress != ""
	self.Onboarded = onboardedAt != nil
	return self, nil
}

// CompleteOnboarding records the handle and name an account holder has chosen for
// themselves, and the avatar they picked if they picked one.
//
// It is a whole-profile write rather than a partial update because it describes a
// moment: the account stops being an email address with a derived name and starts
// being a person the site can credit. Everything is set together, and the stamp
// is written once — re-running it later must not claim a second onboarding.
func (s *Store) CompleteOnboarding(ctx context.Context, userID, handle, displayName, bio, avatarRef string) (domain.SelfUser, error) {
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET
			handle       = $2::citext,
			display_name = $3,
			bio          = NULLIF($4, ''),
			avatar_url   = CASE WHEN $5::text IS NULL THEN avatar_url ELSE NULLIF($5, '') END,
			onboarded_at = COALESCE(onboarded_at, now())
		WHERE id = $1`,
		userID, handle, displayName, bio, avatarRef)
	if err != nil {
		if isUniqueViolationOn(err, "handle") {
			return domain.SelfUser{}, ErrConflict
		}
		return domain.SelfUser{}, normalize(err)
	}
	return s.SelfProfile(ctx, userID)
}

// SetAvatar changes the picture on an account that has already been onboarded.
// An empty reference removes it, putting the account back on its initials.
func (s *Store) SetAvatar(ctx context.Context, userID, ref string) (domain.SelfUser, error) {
	if _, err := s.pool.Exec(ctx,
		`UPDATE users SET avatar_url = NULLIF($2, '') WHERE id = $1`, userID, ref); err != nil {
		return domain.SelfUser{}, normalize(err)
	}
	return s.SelfProfile(ctx, userID)
}

// ProfileUpdate carries the fields settings may change. A nil pointer means
// "leave this alone", which is what lets one endpoint serve a partial form
// without wiping the fields it did not include.
type ProfileUpdate struct {
	DisplayName *string
	Bio         *string
	Handle      *string
}

// UpdateProfile applies a partial update and returns the resulting profile.
//
// COALESCE against the parameter, rather than a query assembled from whichever
// fields were present, keeps this to one prepared statement with a fixed shape.
func (s *Store) UpdateProfile(ctx context.Context, userID string, up ProfileUpdate) (domain.SelfUser, error) {
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET
			display_name = COALESCE($2, display_name),
			bio          = COALESCE($3, bio),
			handle       = COALESCE($4, handle)
		WHERE id = $1`,
		userID, up.DisplayName, up.Bio, up.Handle)
	if err != nil {
		if isUniqueViolationOn(err, "handle") {
			return domain.SelfUser{}, ErrConflict
		}
		return domain.SelfUser{}, normalize(err)
	}
	return s.SelfProfile(ctx, userID)
}

// PayoutAddress returns the address a creator's donations should be sent to.
// An empty string means the creator has not verified one, which is what the
// donation endpoint checks before it will record an intent.
func (s *Store) PayoutAddress(ctx context.Context, userID string) (string, error) {
	var address string
	err := s.pool.QueryRow(ctx,
		`SELECT COALESCE(payout_address, '') FROM users WHERE id = $1 AND status = 'active'`,
		userID).Scan(&address)
	return address, normalize(err)
}

// Stats is the public snapshot on the landing page.
//
// Every figure counts only what is already public: creators with a published
// timelapse, published rows, and confirmed donations. Nothing here reveals the
// contents or the depth of the review queue.
func (s *Store) Stats(ctx context.Context) (domain.Stats, error) {
	var st domain.Stats
	err := s.pool.QueryRow(ctx, `
		SELECT
			(SELECT count(DISTINCT user_id) FROM timelapses WHERE status = 'published'),
			(SELECT count(*) FROM timelapses WHERE status = 'published'),
			(SELECT COALESCE(sum(session_minutes), 0) FROM timelapses WHERE status = 'published'),
			(SELECT count(*) FROM donations WHERE status = 'confirmed'),
			(SELECT COALESCE(sum(amount_lamports), 0) FROM donations WHERE status = 'confirmed')`).
		Scan(&st.Creators, &st.Published, &st.SessionMinutes, &st.DonationCount, &st.DonationTotal)
	return st, normalize(err)
}

// RecordAudit appends an operator action. Failures are the caller's to log, not
// to fail the request over: losing an audit line must never undo a decision
// that has already been applied.
func (s *Store) RecordAudit(ctx context.Context, actorID, action, subjectType, subjectID string, metadata map[string]any) error {
	// Marshalled here and passed as text for the ::jsonb cast. The driver has
	// no encoding plan for a bare map, and []byte would go over as bytea, which
	// the cast then rejects — either way the audit line is silently lost.
	if metadata == nil {
		metadata = map[string]any{}
	}
	encoded, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("store: encode audit metadata: %w", err)
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO audit_log (actor_id, action, subject_type, subject_id, metadata)
		VALUES (NULLIF($1,'')::uuid, $2, $3, $4, $5::jsonb)`,
		actorID, action, subjectType, subjectID, string(encoded))
	return normalize(err)
}
