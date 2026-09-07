// Package config loads and validates runtime configuration from the
// environment. Configuration is read once at startup and never re-read, so a
// misconfigured process fails immediately instead of at the first request.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env      string
	LogLevel string

	Port           string
	PublicAPIURL   string
	WebURL         string
	AdminURL       string
	AllowedOrigins []string

	DatabaseURL      string
	DatabaseMaxConns int32

	SessionSecret     []byte
	SessionCookieName string
	SessionTTL        time.Duration
	MagicLinkTTL      time.Duration

	ResendAPIKey string
	EmailFrom    string
	EmailReplyTo string

	SolanaCluster   string
	SolanaRPCURL    string
	SolanaProgramID string
	Treasury        string
	PlatformFeeBPS  int

	StorageEndpoint  string
	StorageBucket    string
	StorageRegion    string
	StorageKeyID     string
	StorageSecret    string
	StoragePublicURL string
	UploadMaxBytes   int64
	UploadURLTTL     time.Duration

	RateLimitAnon     int
	RateLimitUser     int
	RateLimitAuth     int
	RateLimitComments int
}

// IsProduction reports whether relaxed development behaviour is forbidden.
func (c Config) IsProduction() bool { return c.Env == "production" }

// Load reads configuration from the environment and validates it.
func Load() (Config, error) {
	c := Config{
		Env:      env("APP_ENV", "development"),
		LogLevel: env("LOG_LEVEL", "info"),

		Port:         env("API_PORT", "8080"),
		PublicAPIURL: env("API_PUBLIC_URL", "http://localhost:8080"),
		WebURL:       env("WEB_PUBLIC_URL", "http://localhost:3000"),
		AdminURL:     env("ADMIN_PUBLIC_URL", "http://localhost:3001"),

		DatabaseURL:      os.Getenv("DATABASE_URL"),
		DatabaseMaxConns: int32(envInt("DATABASE_MAX_CONNS", 10)),

		SessionSecret:     []byte(os.Getenv("SESSION_SECRET")),
		SessionCookieName: env("SESSION_COOKIE_NAME", "sardhana_session"),
		SessionTTL:        time.Duration(envInt("SESSION_TTL_HOURS", 720)) * time.Hour,
		MagicLinkTTL:      time.Duration(envInt("MAGIC_LINK_TTL_MINUTES", 15)) * time.Minute,

		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		EmailFrom:    env("EMAIL_FROM", "Sardhana <login@localhost>"),
		EmailReplyTo: os.Getenv("EMAIL_REPLY_TO"),

		SolanaCluster:   env("SOLANA_CLUSTER", "devnet"),
		SolanaRPCURL:    env("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
		SolanaProgramID: os.Getenv("SOLANA_PROGRAM_ID"),
		Treasury:        os.Getenv("PLATFORM_TREASURY"),
		PlatformFeeBPS:  envInt("PLATFORM_FEE_BPS", 250),

		StorageEndpoint:  os.Getenv("STORAGE_ENDPOINT"),
		StorageBucket:    os.Getenv("STORAGE_BUCKET"),
		StorageRegion:    env("STORAGE_REGION", "us-east-1"),
		StorageKeyID:     os.Getenv("STORAGE_ACCESS_KEY_ID"),
		StorageSecret:    os.Getenv("STORAGE_SECRET_ACCESS_KEY"),
		StoragePublicURL: os.Getenv("STORAGE_PUBLIC_BASE_URL"),
		UploadMaxBytes:   int64(envInt("UPLOAD_MAX_BYTES", 2<<30)),
		UploadURLTTL:     time.Duration(envInt("UPLOAD_URL_TTL_MINUTES", 15)) * time.Minute,

		RateLimitAnon: envInt("RATE_LIMIT_ANON", 60),
		RateLimitUser: envInt("RATE_LIMIT_USER", 240),
		RateLimitAuth: envInt("RATE_LIMIT_AUTH_ATTEMPTS", 5),
		// Comments need their own budget: sharing the sign-in allowance meant a
		// person posting a comment and then a reply was refused the second one.
		RateLimitComments: envInt("RATE_LIMIT_COMMENTS", 20),
	}

	origins := env("CORS_ALLOWED_ORIGINS", c.WebURL+","+c.AdminURL)
	for _, o := range strings.Split(origins, ",") {
		if o = strings.TrimSpace(strings.TrimRight(o, "/")); o != "" {
			c.AllowedOrigins = append(c.AllowedOrigins, o)
		}
	}

	return c, c.validate()
}

func (c Config) validate() error {
	var problems []string
	if c.DatabaseURL == "" {
		problems = append(problems, "DATABASE_URL is required")
	}
	// 32 bytes of key material is the floor for HMAC-signed CSRF tokens.
	if len(c.SessionSecret) < 32 {
		problems = append(problems, "SESSION_SECRET must be at least 32 bytes")
	}
	if len(c.AllowedOrigins) == 0 {
		problems = append(problems, "CORS_ALLOWED_ORIGINS must list at least one origin")
	}
	if c.PlatformFeeBPS < 0 || c.PlatformFeeBPS > 1000 {
		problems = append(problems, "PLATFORM_FEE_BPS must be between 0 and 1000")
	}

	if c.IsProduction() {
		// Development conveniences are refused outright in production rather
		// than degraded, so a missing variable cannot silently weaken the
		// deployment.
		if c.ResendAPIKey == "" {
			problems = append(problems, "RESEND_API_KEY is required in production")
		}
		if !strings.HasPrefix(c.WebURL, "https://") {
			problems = append(problems, "WEB_PUBLIC_URL must use https in production")
		}
		if c.StorageBucket == "" || c.StorageKeyID == "" {
			problems = append(problems, "object storage credentials are required in production")
		}
		if c.SolanaCluster != "mainnet-beta" {
			problems = append(problems, "SOLANA_CLUSTER must be mainnet-beta in production")
		}
	}

	if len(problems) > 0 {
		return fmt.Errorf("configuration invalid:\n  - %s", strings.Join(problems, "\n  - "))
	}
	return nil
}

// ErrMissing is returned when a required variable is absent.
var ErrMissing = errors.New("missing configuration")

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
