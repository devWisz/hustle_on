package auth

import (
	"context"
	"net/netip"
	"time"
)

// User is the minimum the auth module needs to know about an account.
type User struct {
	ID            string
	Email         string
	Handle        string
	DisplayName   string
	Role          string
	Status        string
	EmailVerified bool
}

// Active reports whether the account may hold a session at all.
func (u User) Active() bool { return u.Status == "active" }

// MagicLink is a pending or consumed email login token.
type MagicLink struct {
	ID         string
	UserID     string
	Email      string
	TokenHash  []byte
	ExpiresAt  time.Time
	ConsumedAt *time.Time
	IP         netip.Addr
	UserAgent  string
	CreatedAt  time.Time
}

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

// WalletChallenge is a nonce the account must sign to prove it controls the
// address donations will be sent to.
type WalletChallenge struct {
	UserID    string
	Address   string
	Nonce     string
	ExpiresAt time.Time
}

// Store is the persistence contract. The backend implements it over Postgres;
// tests implement it in memory.
//
// ConsumeMagicLink and ConsumeWalletChallenge must be atomic — a token that two
// concurrent requests present may only succeed once.
type Store interface {
	UserByID(ctx context.Context, id string) (User, error)
	UserByEmail(ctx context.Context, email string) (User, error)
	CreateUser(ctx context.Context, email, handle, displayName string) (User, error)
	MarkEmailVerified(ctx context.Context, userID string, at time.Time) error

	CreateMagicLink(ctx context.Context, link MagicLink) error
	ConsumeMagicLink(ctx context.Context, digest []byte, now time.Time) (MagicLink, error)
	CountRecentMagicLinks(ctx context.Context, email string, since time.Time) (int, error)

	CreateSession(ctx context.Context, s Session) error
	SessionByHash(ctx context.Context, digest []byte) (Session, error)
	TouchSession(ctx context.Context, id string, at time.Time) error
	RevokeSession(ctx context.Context, digest []byte, at time.Time) error
	RevokeUserSessions(ctx context.Context, userID string, at time.Time) error

	CreateWalletChallenge(ctx context.Context, c WalletChallenge) error
	ConsumeWalletChallenge(ctx context.Context, userID, address, nonce string, now time.Time) error
	// SetPayoutAddress records a proven address. An address belongs to one
	// account only, so claiming one already held elsewhere must fail rather
	// than move it.
	SetPayoutAddress(ctx context.Context, userID, address string, at time.Time) error
}

// Mailer delivers transactional email. resend.go provides the implementation.
type Mailer interface {
	Send(ctx context.Context, msg Message) error
}

// Message is a single outbound email.
type Message struct {
	To      string
	Subject string
	HTML    string
	Text    string
	Tag     string
}
