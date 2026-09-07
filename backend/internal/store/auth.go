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

const userColumns = `u.id::text, u.email::text, u.handle::text, u.display_name,
	u.role::text, u.status::text, (u.email_verified_at IS NOT NULL)`

func (s *Store) UserByID(ctx context.Context, id string) (auth.User, error) {
	return s.scanUser(ctx, `SELECT `+userColumns+` FROM users u WHERE u.id = $1`, id)
}

func (s *Store) UserByEmail(ctx context.Context, email string) (auth.User, error) {
	return s.scanUser(ctx, `SELECT `+userColumns+` FROM users u WHERE u.email = $1`, email)
}

func (s *Store) UserByHandle(ctx context.Context, handle string) (auth.User, error) {
	return s.scanUser(ctx, `SELECT `+userColumns+` FROM users u WHERE u.handle = $1`, handle)
}

func (s *Store) scanUser(ctx context.Context, query string, arg any) (auth.User, error) {
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

// CreateUser inserts the account and its profile row together, so no user can
// exist without a profile to render.
func (s *Store) CreateUser(ctx context.Context, email, handle, displayName string) (auth.User, error) {
	var u auth.User
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return auth.User{}, normalize(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = tx.QueryRow(ctx, `
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

	if _, err = tx.Exec(ctx, `INSERT INTO profiles (user_id) VALUES ($1)`, u.ID); err != nil {
		return auth.User{}, normalize(err)
	}
	if err = tx.Commit(ctx); err != nil {
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
			(user_id, email, token_hash, purpose, expires_at, request_ip, request_user_agent)
		VALUES (NULLIF($1,'')::uuid, $2, $3, $4::auth_purpose, $5, $6, $7)`,
		link.UserID, link.Email, link.TokenHash, link.Purpose,
		link.ExpiresAt, nullIP(link.IP), nullText(link.UserAgent))
	return normalize(err)
}

// ConsumeMagicLink marks a token used and returns it, in one statement.
// The `consumed_at IS NULL` predicate inside the UPDATE is what makes the link
// genuinely single-use: two concurrent requests race on the row lock and only
// the first sees a returned row.
func (s *Store) ConsumeMagicLink(ctx context.Context, digest []byte, now time.Time) (auth.MagicLink, error) {
	var link auth.MagicLink
	var userID *string
	err := s.pool.QueryRow(ctx, `
		UPDATE magic_link_tokens
		SET consumed_at = $2
		WHERE token_hash = $1
		  AND consumed_at IS NULL
		  AND expires_at > $2
		RETURNING id::text, user_id::text, email::text, purpose::text, expires_at, created_at`,
		digest, now).Scan(&link.ID, &userID, &link.Email, &link.Purpose, &link.ExpiresAt, &link.CreatedAt)
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
		INSERT INTO sessions (user_id, token_hash, generation, ip, user_agent, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		sess.UserID, sess.TokenHash, sess.Generation,
		nullIP(sess.IP), nullText(sess.UserAgent), sess.ExpiresAt)
	return normalize(err)
}

func (s *Store) SessionByHash(ctx context.Context, digest []byte) (auth.Session, error) {
	var sess auth.Session
	err := s.pool.QueryRow(ctx, `
		SELECT id::text, user_id::text, generation, expires_at, revoked_at, last_used_at, created_at
		FROM sessions WHERE token_hash = $1`, digest).Scan(
		&sess.ID, &sess.UserID, &sess.Generation, &sess.ExpiresAt,
		&sess.RevokedAt, &sess.LastUsedAt, &sess.CreatedAt)
	if err != nil {
		return auth.Session{}, normalize(err)
	}
	sess.TokenHash = digest
	return sess, nil
}

func (s *Store) TouchSession(ctx context.Context, id string, at time.Time) error {
	_, err := s.pool.Exec(ctx, `UPDATE sessions SET last_used_at = $2 WHERE id = $1`, id, at)
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

// AttachWallet links a verified wallet. A wallet address belongs to exactly one
// account: claiming one already attached elsewhere is a conflict, not a move.
func (s *Store) AttachWallet(ctx context.Context, userID, address string, primary bool) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return normalize(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if primary {
		if _, err := tx.Exec(ctx,
			`UPDATE wallets SET is_primary = false WHERE user_id = $1`, userID); err != nil {
			return normalize(err)
		}
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO wallets (user_id, address, is_primary)
		VALUES ($1, $2, $3)
		ON CONFLICT (address) DO UPDATE SET is_primary = EXCLUDED.is_primary
		WHERE wallets.user_id = EXCLUDED.user_id`,
		userID, address, primary); err != nil {
		return normalize(err)
	}
	return normalize(tx.Commit(ctx))
}
