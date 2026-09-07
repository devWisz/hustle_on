package auth

import (
	"errors"
	"time"
)

// Config holds the tunables for a Service. Zero values are replaced by the
// defaults in NewService.
type Config struct {
	// AppURL is the public origin of the web app, used to build login links.
	AppURL string
	// CookieName is the session cookie name.
	CookieName string
	// CookieDomain scopes the cookie; empty means host-only, which is the
	// safer default and correct for single-domain deployments.
	CookieDomain string
	// Secure marks cookies HTTPS-only. Never disable outside local development.
	Secure bool
	// SessionTTL is how long a session lasts before re-authentication.
	SessionTTL time.Duration
	// MagicLinkTTL is the login link validity window. Short by design.
	MagicLinkTTL time.Duration
	// MaxLinksPerHour caps link requests per email address.
	MaxLinksPerHour int
	// CSRFKey signs double-submit CSRF tokens. Must be at least 32 bytes.
	CSRFKey []byte
	// ProductName appears in email subjects and bodies.
	ProductName string
}

func (c *Config) withDefaults() {
	if c.CookieName == "" {
		c.CookieName = "sardhana_session"
	}
	if c.SessionTTL == 0 {
		c.SessionTTL = 30 * 24 * time.Hour
	}
	if c.MagicLinkTTL == 0 {
		c.MagicLinkTTL = 15 * time.Minute
	}
	if c.MaxLinksPerHour == 0 {
		c.MaxLinksPerHour = 5
	}
	if c.ProductName == "" {
		c.ProductName = "Sardhana"
	}
}

// Service is the entry point for every authentication operation.
type Service struct {
	cfg    Config
	store  Store
	mailer Mailer
	now    func() time.Time
}

// NewService validates the configuration and returns a ready Service.
func NewService(cfg Config, store Store, mailer Mailer) (*Service, error) {
	cfg.withDefaults()
	if store == nil {
		return nil, errors.New("auth: store is required")
	}
	if mailer == nil {
		return nil, errors.New("auth: mailer is required")
	}
	if cfg.AppURL == "" {
		return nil, errors.New("auth: AppURL is required")
	}
	if len(cfg.CSRFKey) < 32 {
		return nil, errors.New("auth: CSRFKey must be at least 32 bytes")
	}
	return &Service{cfg: cfg, store: store, mailer: mailer, now: time.Now}, nil
}

// SetClock replaces the time source. Tests use it; production does not.
func (s *Service) SetClock(fn func() time.Time) { s.now = fn }

// Config returns a copy of the effective configuration.
func (s *Service) Config() Config { return s.cfg }
