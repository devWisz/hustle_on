package auth

import (
	"context"
	"net/netip"
	"time"
)

// User is the minimum the auth module needs to know about an account.
//
// Identity is WalletAddress. There is no password and no email credential: the
// only thing that can authenticate an account is a signature by the key behind
// this address.
type User struct {
	ID            string
	WalletAddress string
	// Email is an identity for an account that signs in with a password, and
	// optional contact information for one that signs in with a wallet. It is
	// never both roles at once in practice: an account gets it when it needs it.
	Email       string
	Handle      string
	DisplayName string
	Role        string
	Status      string
}

// Active reports whether the account may hold a session at all.
func (u User) Active() bool { return u.Status == "active" }

// IsAdmin reports whether the account carries the operator role.
func (u User) IsAdmin() bool { return u.Role == "admin" }

// Session is a server-side session record. The plaintext token lives only in
// the client's cookie.
type Session struct {
	ID         string
	UserID     string
	TokenHash  []byte
	IP         netip.Addr
	UserAgent  string
	ExpiresAt  time.Time
	RevokedAt  *time.Time
	LastUsedAt time.Time
	CreatedAt  time.Time
}

// Valid reports whether the session may still authenticate a request.
func (s Session) Valid(now time.Time) bool {
	return s.RevokedAt == nil && now.Before(s.ExpiresAt)
}

// Challenge purposes. A challenge is a nonce the account signs; which one it is
// decides what a valid signature is allowed to do.
const (
	// PurposeSignIn authorises a session. It is created before the account is
	// known to exist, so UserID is empty.
	PurposeSignIn = "signin"
	// PurposePayout re-points where donations are sent. It requires an existing
	// account, because it changes one.
	PurposePayout = "payout"
)

// WalletChallenge is a single-use nonce awaiting a signature.
type WalletChallenge struct {
	// UserID is empty for a sign-in challenge and set for a payout change.
	UserID    string
	Address   string
	Nonce     string
	Purpose   string
	ExpiresAt time.Time
}

// Store is the persistence contract. The backend implements it over Postgres;
// tests implement it in memory.
//
// Every Consume method must be atomic — a nonce that two concurrent requests
// present may only succeed once.
type Store interface {
	UserByID(ctx context.Context, id string) (User, error)

	// UserByWallet resolves the account that signs in with this address. It
	// returns ErrNotFound when the address has never been seen, which is the
	// expected path for a first-ever sign-in rather than an error.
	UserByWallet(ctx context.Context, address string) (User, error)

	// CreateUser registers an account for an address that has just proven it
	// holds the matching key. The handle is a generated placeholder; onboarding
	// replaces it.
	CreateUser(ctx context.Context, walletAddress, handle, displayName string) (User, error)

	// CreatePasswordUser registers an account from an email address and an encoded
	// password hash. It returns ErrEmailTaken when the address already has an
	// account, which is a case the caller reports rather than retries.
	CreatePasswordUser(ctx context.Context, email, handle, displayName, passwordHash string) (User, error)

	// PasswordCredentials looks up an account by email for a password sign-in. The
	// hash is returned beside the user rather than on it, so it cannot travel
	// anywhere a User travels by accident. An account with no password returns an
	// empty hash and no error.
	PasswordCredentials(ctx context.Context, email string) (User, string, error)

	// SetPasswordHash stores a new encoded hash.
	SetPasswordHash(ctx context.Context, userID, passwordHash string) error

	// PromoteToAdmin grants the operator role. It is called when a wallet that
	// appears in ADMIN_WALLETS signs in, so admin access is a property of the
	// environment rather than something edited into a row by hand.
	PromoteToAdmin(ctx context.Context, userID string) error

	CreateSession(ctx context.Context, s Session) error
	SessionByHash(ctx context.Context, digest []byte) (Session, error)
	TouchSession(ctx context.Context, id string, at time.Time) error
	RevokeSession(ctx context.Context, digest []byte, at time.Time) error
	RevokeUserSessions(ctx context.Context, userID string, at time.Time) error

	CreateWalletChallenge(ctx context.Context, c WalletChallenge) error
	// CountOpenChallenges reports how many unspent, unexpired nonces this
	// address is already holding, so a client cannot fill the table by asking
	// in a loop.
	CountOpenChallenges(ctx context.Context, address string, now time.Time) (int, error)
	// ConsumeSignInChallenge spends a sign-in nonce. It is not scoped to an
	// account because the account may not exist yet.
	ConsumeSignInChallenge(ctx context.Context, address, nonce string, now time.Time) error
	// ConsumeWalletChallenge spends a payout nonce belonging to userID.
	ConsumeWalletChallenge(ctx context.Context, userID, address, nonce string, now time.Time) error

	// SetPayoutAddress records a proven address. An address belongs to one
	// account only, so claiming one already held elsewhere must fail rather
	// than move it.
	SetPayoutAddress(ctx context.Context, userID, address string, at time.Time) error
}
