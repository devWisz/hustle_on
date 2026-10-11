package auth

import (
	"errors"
	"fmt"
	"time"
)

// Config holds the tunables for a Service. Zero values are replaced by the
// defaults in NewService.
type Config struct {
	// AppURL is the public origin of the web app. It is quoted inside the
	// message a wallet signs, so a signature collected by a different site
	// cannot be replayed here.
	AppURL string
	// ProductName is the name shown in the message the wallet displays.
	ProductName string
	// CookieName is the session cookie name.
	CookieName string
	// CookieDomain scopes the cookie; empty means host-only, which is the
	// safer default and correct for single-domain deployments.
	CookieDomain string
	// Secure marks cookies HTTPS-only. Never disable outside local development.
	Secure bool
	// SessionTTL is how long a session lasts before re-authentication.
	SessionTTL time.Duration
	// ChallengeTTL is how long a sign-in nonce stays signable. Short by design:
	// it only has to outlive the moment between the click and the signature.
	ChallengeTTL time.Duration
	// MaxChallengeAttempts caps how many unspent nonces one address may hold at
	// once, so a client cannot fill the table by asking in a loop.
	MaxChallengeAttempts int
	// CSRFKey signs double-submit CSRF tokens. Must be at least 32 bytes.
	CSRFKey []byte
}

func (c *Config) withDefaults() {
	if c.ProductName == "" {
		c.ProductName = "Hustle On"
	}
	if c.CookieName == "" {
		c.CookieName = "hustleon_session"
	}
	if c.SessionTTL == 0 {
		c.SessionTTL = 30 * 24 * time.Hour
	}
	if c.ChallengeTTL == 0 {
		c.ChallengeTTL = 5 * time.Minute
	}
	if c.MaxChallengeAttempts == 0 {
		c.MaxChallengeAttempts = 5
	}
}

// Service is the entry point for every authentication operation.
//
// It is deliberately smaller than it used to be. Signing in used to involve a
// store, a mailer and a URL builder; now it involves a store and a signature,
// and there is no third party left that a sign-in can depend on.
type Service struct {
	cfg    Config
	store  Store
	hasher PasswordHasher
	now    func() time.Time
	// dummyHash is a real hash of a value nobody knows, verified against when an
	// email address is not found. Doing the same work for a miss as for a hit is
	// what keeps the response time from answering the question the error message
	// deliberately refuses to.
	dummyHash string
}

// NewService validates the configuration and returns a ready Service.
func NewService(cfg Config, store Store, hasher PasswordHasher) (*Service, error) {
	cfg.withDefaults()
	if store == nil {
		return nil, errors.New("auth: store is required")
	}
	if hasher == nil {
		return nil, errors.New("auth: password hasher is required")
	}
	if cfg.AppURL == "" {
		return nil, errors.New("auth: AppURL is required")
	}
	if len(cfg.CSRFKey) < 32 {
		return nil, errors.New("auth: CSRFKey must be at least 32 bytes")
	}
	// The verifier for an unknown address needs a genuine hash to work against, or
	// it would return instantly and defeat its own purpose. Generated once, here,
	// so no request ever pays for it.
	dummy, err := hasher.Hash("this is not a password anybody has")
	if err != nil {
		return nil, fmt.Errorf("auth: build timing decoy: %w", err)
	}
	return &Service{cfg: cfg, store: store, hasher: hasher, now: time.Now, dummyHash: dummy}, nil
}

// SetClock replaces the time source. Tests use it; production does not.
func (s *Service) SetClock(fn func() time.Time) { s.now = fn }
