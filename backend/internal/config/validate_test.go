package config

import (
	"strings"
	"testing"
)

// validConfig is a configuration that validates, so each test can vary the one
// field it is about instead of restating every other one.
func validConfig() Config {
	return Config{
		Env:                "development",
		WebURL:             "https://hustleon.com",
		AllowedOrigins:     []string{"https://hustleon.com"},
		DatabaseURL:        "postgres://user:pw@host/sardhana?sslmode=require",
		DatabaseMaxConns:   10,
		SessionSecret:      make([]byte, 32),
		SessionCookieName:  "hustleon_session",
		RateLimitAnon:      300,
		RateLimitAuth:      5,
		RateLimitEngage:    60,
		RateLimitWrite:     60,
		RateLimitUpload:    10,
		RateLimitPoster:    60,
		RateLimitDonate:    10,
		RateLimitAdmin:     240,
		RateLimitIPCeiling: 1200,
	}
}

func TestAReferenceConfigurationValidates(t *testing.T) {
	if err := validConfig().validate(); err != nil {
		t.Fatalf("the reference configuration was rejected: %v", err)
	}
}

// productionConfig is validConfig with the extra variables production insists
// on, so the production-only rules can be tested in isolation.
func productionConfig() Config {
	c := validConfig()
	c.Env = "production"
	c.ResendAPIKey = "re_test"
	c.EmailFrom = "Hustle On <hello@hustleon.com>"
	c.StorageBucket = "hustleon-media"
	c.StorageKeyID = "key"
	c.StorageSecret = "secret"
	c.SolanaCluster = "mainnet-beta"
	return c
}

// A cookie name is written into a Set-Cookie header verbatim. A name containing
// a separator would turn the rest of itself into attributes, which is how a
// misconfiguration becomes a cookie-injection bug.
func TestCookieNameMustBeAToken(t *testing.T) {
	for _, bad := range []string{"", "session; Path=/", "session name", "session=1", "sessão"} {
		c := validConfig()
		c.SessionCookieName = bad
		if err := c.validate(); err == nil {
			t.Errorf("cookie name %q was accepted", bad)
		}
	}
	for _, good := range []string{"hustleon_session", "__Host-session", "s.id~1"} {
		c := validConfig()
		c.SessionCookieName = good
		if err := c.validate(); err != nil {
			t.Errorf("cookie name %q was rejected: %v", good, err)
		}
	}
}

// A zero budget is not "unlimited" here, but it is a misconfiguration: the
// operator meant to set a number and the value they typed did not survive.
func TestRateLimitBudgetsMustBePositive(t *testing.T) {
	c := validConfig()
	c.RateLimitWrite = 0
	err := c.validate()
	if err == nil {
		t.Fatal("a zero write budget was accepted")
	}
	if !strings.Contains(err.Error(), "RATE_LIMIT_WRITE") {
		t.Errorf("error did not name the offending variable: %v", err)
	}
}

// Session digests, emails and payout addresses cross this connection, so
// production refuses a DSN that would let it fall back to plaintext.
func TestProductionRefusesAWeakerTLSMode(t *testing.T) {
	for _, mode := range []string{"disable", "allow", "prefer", ""} {
		c := productionConfig()
		c.DatabaseURL = "postgres://user:pw@host/hustleon"
		if mode != "" {
			c.DatabaseURL += "?sslmode=" + mode
		}
		if err := c.validate(); err == nil {
			t.Errorf("production accepted sslmode=%q", mode)
		}
	}
	for _, mode := range []string{"require", "verify-ca", "verify-full"} {
		c := productionConfig()
		c.DatabaseURL = "postgres://user:pw@host/sardhana?sslmode=" + mode
		if err := c.validate(); err != nil {
			t.Errorf("production rejected sslmode=%q: %v", mode, err)
		}
	}
}

func TestSSLModeIsReadFromBothDSNShapes(t *testing.T) {
	cases := map[string]string{
		"postgres://u:p@h/db?sslmode=require":                        "require",
		"postgres://u:p@h/db?sslmode=require&x=1":                    "require",
		"postgres://u:p@h/db?application_name=a&sslmode=verify-full": "verify-full",
		"host=h dbname=d sslmode=disable user=u":                     "disable",
		"postgres://u:p@h/db":                                        "",
	}
	for dsn, want := range cases {
		if got := sslMode(dsn); got != want {
			t.Errorf("sslMode(%q) = %q, want %q", dsn, got, want)
		}
	}
}

// A pooled Neon endpoint has a hard connection ceiling; asking for more than
// this is a configuration mistake that shows up as connection errors under load.
func TestDatabasePoolSizeIsBounded(t *testing.T) {
	c := validConfig()
	c.DatabaseMaxConns = 500
	if err := c.validate(); err == nil {
		t.Fatal("an absurd pool size was accepted")
	}
}
