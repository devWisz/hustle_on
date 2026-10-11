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

const authUserColumns = `u.id::text, COALESCE(u.wallet_address::text, ''), COALESCE(u.email::text, ''),
	u.handle::text, u.display_name, u.role::text, u.status::text`

// The same projection without the table alias. `INSERT ... RETURNING` has no
// alias to qualify against, and using the aliased list there fails at runtime
// with "missing FROM-clause entry" — which no unit test would have caught,
// because the rule they exercise lives above the SQL.
const authUserColumnsBare = `id::text, COALESCE(wallet_address::text, ''), COALESCE(email::text, ''),
	handle::text, display_name, role::text, status::text`

func (s *Store) UserByID(ctx context.Context, id string) (auth.User, error) {
	return s.scanAuthUser(ctx, `SELECT `+authUserColumns+` FROM users u WHERE u.id = $1`, id)
}

// UserByWallet resolves the account that signs in with an address.
//
// The lookup is by the login address, never by a payout address: being paid at
// an address is not the same as being able to sign for it, and only the second
// of those may open a session.
func (s *Store) UserByWallet(ctx context.Context, address string) (auth.User, error) {
	return s.scanAuthUser(ctx, `SELECT `+authUserColumns+` FROM users u WHERE u.wallet_address = $1`, address)
}

func (s *Store) scanAuthUser(ctx context.Context, query string, arg any) (auth.User, error) {
	var u auth.User
	err := s.pool.QueryRow(ctx, query, arg).Scan(
		&u.ID, &u.WalletAddress, &u.Email, &u.Handle, &u.DisplayName, &u.Role, &u.Status)
	if err != nil {
		if errors.Is(normalize(err), ErrNotFound) {
			return auth.User{}, auth.ErrNotFound
		}
		return auth.User{}, normalize(err)
	}
	return u, nil
}

// CreateUser registers an account for an address that has just proven it holds
// the matching key. The display name starts as the generated handle; onboarding
// replaces both a moment later.
func (s *Store) CreateUser(ctx context.Context, walletAddress, handle, displayName string) (auth.User, error) {
	var u auth.User
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (wallet_address, handle, display_name)
		VALUES ($1, $2, $3)
		RETURNING `+authUserColumnsBare,
		walletAddress, handle, displayName).Scan(
		&u.ID, &u.WalletAddress, &u.Email, &u.Handle, &u.DisplayName, &u.Role, &u.Status)
	if err != nil {
		if isUniqueViolationOn(err, "handle") {
			return auth.User{}, auth.ErrHandleTaken
		}
		// Two simultaneous first-ever sign-ins with the same wallet can race.
		// The unique index is what actually prevents a second account; the
		// caller retries the lookup and finds the row the other request wrote.
		if isUniqueViolationOn(err, "wallet_address") {
			return auth.User{}, auth.ErrNotFound
		}
		return auth.User{}, normalize(err)
	}
	return u, nil
}

// CreatePasswordUser registers an account from an email address and an encoded
// password hash.
//
// A duplicate address is returned as ErrEmailTaken rather than retried: unlike a
// generated handle colliding, two people claiming one address is a fact the person
// signing up needs to be told, not a coincidence to paper over.
func (s *Store) CreatePasswordUser(ctx context.Context, email, handle, displayName, passwordHash string) (auth.User, error) {
	var u auth.User
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (email, password_hash, handle, display_name, onboarded_at)
		VALUES ($1, $2, $3, $4, now())
		RETURNING `+authUserColumnsBare,
		email, passwordHash, handle, displayName).Scan(
		&u.ID, &u.WalletAddress, &u.Email, &u.Handle, &u.DisplayName, &u.Role, &u.Status)
	if err != nil {
		if isUniqueViolationOn(err, "email") {
			return auth.User{}, auth.ErrEmailTaken
		}
		if isUniqueViolationOn(err, "handle") {
			return auth.User{}, auth.ErrHandleTaken
		}
		return auth.User{}, normalize(err)
	}
	return u, nil
}

// PasswordCredentials looks up an account for a password sign-in.
//
// The hash is returned beside the user rather than on it, so it cannot reach a
// response payload by travelling with a User. An account with no password comes
// back with an empty hash and no error: that is a real state — the account exists
// and signs in with a wallet — and the caller has to answer it the same way it
// answers a wrong password.
func (s *Store) PasswordCredentials(ctx context.Context, email string) (auth.User, string, error) {
	var u auth.User
	var hash *string
	err := s.pool.QueryRow(ctx, `
		SELECT `+authUserColumns+`, u.password_hash
		FROM users u WHERE u.email = $1`, email).Scan(
		&u.ID, &u.WalletAddress, &u.Email, &u.Handle, &u.DisplayName, &u.Role, &u.Status, &hash)
	if err != nil {
		if errors.Is(normalize(err), ErrNotFound) {
			return auth.User{}, "", auth.ErrNotFound
		}
		return auth.User{}, "", normalize(err)
	}
	return u, deref(hash), nil
}

// SetPasswordHash stores a new encoded hash.
func (s *Store) SetPasswordHash(ctx context.Context, userID, passwordHash string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET password_hash = $2 WHERE id = $1`, userID, passwordHash)
	return normalize(err)
}

// PromoteToAdmin grants the operator role to a wallet listed in ADMIN_WALLETS.
//
// It is idempotent by construction: the WHERE clause only matches accounts that
// are not already admins, so a repeated sign-in is a no-op rather than a write.
// It never demotes — removing an address from the environment is a deliberate
// act that should be done through the console, where it is audited.
func (s *Store) PromoteToAdmin(ctx context.Context, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET role = 'admin' WHERE id = $1 AND role <> 'admin'`, userID)
	return normalize(err)
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

// CreateWalletChallenge records a nonce awaiting a signature.
//
// user_id is NULL for a sign-in challenge: the account it will belong to may not
// exist yet, and creating one on the strength of an unsigned nonce would let
// anybody fill the users table by asking for challenges.
func (s *Store) CreateWalletChallenge(ctx context.Context, c auth.WalletChallenge) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO wallet_challenges (user_id, address, nonce, purpose, expires_at)
		VALUES (NULLIF($1, '')::uuid, $2, $3, $4, $5)`,
		c.UserID, c.Address, c.Nonce, c.Purpose, c.ExpiresAt)
	return normalize(err)
}

func (s *Store) CountOpenChallenges(ctx context.Context, address string, now time.Time) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `
		SELECT count(*) FROM wallet_challenges
		WHERE address = $1 AND consumed_at IS NULL AND expires_at > $2`,
		address, now).Scan(&n)
	return n, normalize(err)
}

// ConsumeSignInChallenge spends a sign-in nonce, in one statement.
//
// The `consumed_at IS NULL` predicate inside the UPDATE is what makes it
// single-use: two concurrent presentations of the same signature race on the row
// lock and only the first sees a returned row. A signature is not a secret, so
// this is the only thing standing between a captured one and a second session.
func (s *Store) ConsumeSignInChallenge(ctx context.Context, address, nonce string, now time.Time) error {
	return s.consumeChallenge(ctx, `user_id IS NULL AND purpose = 'signin'`,
		[]any{address, nonce, now}, now)
}

// ConsumeWalletChallenge spends a payout nonce belonging to userID.
func (s *Store) ConsumeWalletChallenge(ctx context.Context, userID, address, nonce string, now time.Time) error {
	return s.consumeChallenge(ctx, `user_id = $4 AND purpose = 'payout'`,
		[]any{address, nonce, now, userID}, now)
}

func (s *Store) consumeChallenge(ctx context.Context, predicate string, args []any, now time.Time) error {
	var id string
	query := `UPDATE wallet_challenges SET consumed_at = $3
		WHERE address = $1 AND nonce = $2 AND consumed_at IS NULL AND expires_at > $3 AND ` + predicate + `
		RETURNING id::text`
	if err := s.pool.QueryRow(ctx, query, args...).Scan(&id); err != nil {
		return normalize(err)
	}
	return nil
}

// SetPayoutAddress records an address the account has just proven it controls.
//
// Two constraints are enforced here rather than by hoping. The column's own
// UNIQUE constraint stops an address being claimed twice. The NOT EXISTS clause
// stops a subtler case: adopting an address that is somebody else's *login*
// wallet, which would quietly redirect that person's donations into the account
// doing the adopting.
func (s *Store) SetPayoutAddress(ctx context.Context, userID, address string, at time.Time) error {
	tag, err := s.pool.Exec(ctx, `
		UPDATE users SET payout_address = $2, payout_verified_at = $3
		WHERE id = $1
		  AND NOT EXISTS (
		      SELECT 1 FROM users o WHERE o.id <> $1 AND o.wallet_address = $2
		  )`, userID, address, at)
	if err != nil {
		return normalize(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrConflict
	}
	return nil
}

// PurgeExpiredAuth removes challenges and sessions that expired more than thirty
// days ago, through purge_expired_auth as redefined in migration 0013. The
// sign-in-link leg is gone with the table that held them.
func (s *Store) PurgeExpiredAuth(ctx context.Context) (challenges, sessions int64, err error) {
	err = s.pool.QueryRow(ctx, `SELECT challenges, sessions FROM purge_expired_auth()`).
		Scan(&challenges, &sessions)
	return challenges, sessions, normalize(err)
}
