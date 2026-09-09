package store

import (
	"context"
	"errors"
	"time"

	"github.com/sardhana/auth"
)

// This file implements auth.Store. The auth module owns the rules; this file
// owns only their persistence.

var _ auth.Store = (*Store)(nil)

const authUserColumns = `u.id::text, u.email::text, u.handle::text, u.display_name,
	u.role::text, u.status::text, (u.email_verified_at IS NOT NULL)`

func (s *Store) UserByID(ctx context.Context, id string) (auth.User, error) {
	return s.scanAuthUser(ctx, `SELECT `+authUserColumns+` FROM users u WHERE u.id = $1`, id)
}

func (s *Store) UserByEmail(ctx context.Context, email string) (auth.User, error) {
	return s.scanAuthUser(ctx, `SELECT `+authUserColumns+` FROM users u WHERE u.email = $1`, email)
}

func (s *Store) scanAuthUser(ctx context.Context, query string, arg any) (auth.User, error) {
	var u auth.User
	err := s.pool.QueryRow(ctx, query, arg).Scan(
		&u.ID, &u.Email, &u.Handle, &u.DisplayName, &u.Role, &u.Status, &u.EmailVerified)
	if err != nil {
		if errors.Is(normalize(err), ErrNotFound) {
			return auth.User{}, auth.ErrNotFound
		}
		return auth.User{}, normalize(err)
	}
	return u, nil
}

// CreateUser registers an account. The display name starts as the handle; the
// account can change it from settings once signed in.
func (s *Store) CreateUser(ctx context.Context, email, handle, displayName string) (auth.User, error) {
	var u auth.User
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (email, handle, display_name)
		VALUES ($1, $2, $3)
		RETURNING id::text, email::text, handle::text, display_name, role::text, status::text,
		          (email_verified_at IS NOT NULL)`,
		email, handle, displayName).Scan(
		&u.ID, &u.Email, &u.Handle, &u.DisplayName, &u.Role, &u.Status, &u.EmailVerified)
	if err != nil {
		if isUniqueViolationOn(err, "handle") {
			return auth.User{}, auth.ErrHandleTaken
		}
		return auth.User{}, normalize(err)
	}
	return u, nil
}

func (s *Store) MarkEmailVerified(ctx context.Context, userID string, at time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET email_verified_at = COALESCE(email_verified_at, $2) WHERE id = $1`,
		userID, at)
	return normalize(err)
}

func (s *Store) CreateMagicLink(ctx context.Context, link auth.MagicLink) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO magic_link_tokens
			(user_id, email, token_hash, expires_at, request_ip, request_user_agent)
		VALUES (NULLIF($1,'')::uuid, $2, $3, $4, $5, $6)`,
		link.UserID, link.Email, link.TokenHash,
		link.ExpiresAt, nullIP(link.IP), nullText(link.UserAgent))
	return normalize(err)
}

// ConsumeMagicLink marks a token used and returns it, in one statement.
//
// The `consumed_at IS NULL` predicate inside the UPDATE is what makes the link
// genuinely single-use: two concurrent requests race on the row lock, and only
// the first of them sees a returned row.
func (s *Store) ConsumeMagicLink(ctx context.Context, digest []byte, now time.Time) (auth.MagicLink, error) {
	var link auth.MagicLink
	var userID *string
	err := s.pool.QueryRow(ctx, `
		UPDATE magic_link_tokens
		SET consumed_at = $2
		WHERE token_hash = $1
		  AND consumed_at IS NULL
		  AND expires_at > $2
		RETURNING id::text, user_id::text, email::text, expires_at, created_at`,
		digest, now).Scan(&link.ID, &userID, &link.Email, &link.ExpiresAt, &link.CreatedAt)
	if err != nil {
		return auth.MagicLink{}, normalize(err)
	}
	link.UserID = deref(userID)
	link.TokenHash = digest
	return link, nil
}

func (s *Store) CountRecentMagicLinks(ctx context.Context, email string, since time.Time) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM magic_link_tokens WHERE email = $1 AND created_at >= $2`,
		email, since).Scan(&n)
	return n, normalize(err)
}

func (s *Store) CreateSession(ctx context.Context, sess auth.Session) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO sessions (user_id, token_hash, ip, user_agent, expires_at)
		VALUES ($1, $2, $3, $4, $5)`,
		sess.UserID, sess.TokenHash,
		nullIP(sess.IP), nullText(sess.UserAgent), sess.ExpiresAt)
	return normalize(err)
}

func (s *Store) SessionByHash(ctx context.Context, digest []byte) (auth.Session, error) {
	var sess auth.Session
	err := s.pool.QueryRow(ctx, `
		SELECT id::text, user_id::text, expires_at, revoked_at, last_used_at, created_at
		FROM sessions WHERE token_hash = $1`, digest).Scan(
		&sess.ID, &sess.UserID, &sess.ExpiresAt,
		&sess.RevokedAt, &sess.LastUsedAt, &sess.CreatedAt)
	if err != nil {
		return auth.Session{}, normalize(err)
	}
	sess.TokenHash = digest
	return sess, nil
}

func (s *Store) TouchSession(ctx context.Context, id string, at time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sessions SET last_used_at = $2 WHERE id = $1`, id, at)
	return normalize(err)
}

func (s *Store) RevokeSession(ctx context.Context, digest []byte, at time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL`,
		digest, at)
	return normalize(err)
}

func (s *Store) RevokeUserSessions(ctx context.Context, userID string, at time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL`,
		userID, at)
	return normalize(err)
}

func (s *Store) CreateWalletChallenge(ctx context.Context, c auth.WalletChallenge) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO wallet_challenges (user_id, address, nonce, expires_at)
		VALUES ($1, $2, $3, $4)`,
		c.UserID, c.Address, c.Nonce, c.ExpiresAt)
	return normalize(err)
}

func (s *Store) ConsumeWalletChallenge(ctx context.Context, userID, address, nonce string, now time.Time) error {
	var id string
	err := s.pool.QueryRow(ctx, `
		UPDATE wallet_challenges SET consumed_at = $4
		WHERE user_id = $1 AND address = $2 AND nonce = $3
		  AND consumed_at IS NULL AND expires_at > $4
		RETURNING id::text`, userID, address, nonce, now).Scan(&id)
	return normalize(err)
}

// SetPayoutAddress records an address the account has just proven it controls.
//
// The column carries a UNIQUE constraint, so an address already held by another
// account surfaces here as ErrConflict rather than quietly moving to whoever
// claimed it most recently.
func (s *Store) SetPayoutAddress(ctx context.Context, userID, address string, at time.Time) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE users SET payout_address = $2, payout_verified_at = $3 WHERE id = $1`,
		userID, address, at)
	return normalize(err)
}
