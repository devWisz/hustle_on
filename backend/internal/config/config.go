// Package config loads and validates runtime configuration from the
// environment. Configuration is read once at startup and never re-read, so a
// misconfigured process fails immediately instead of at the first request.
package config

import (
	"net/netip"
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

	SessionSecret       []byte
	SessionCookieName   string
	CookieDomain        string
	InternalProxySecret string
	AdminSessionMaxAge  time.Duration
	AdminNetworks       []netip.Prefix
	SessionTTL          time.Duration
	MagicLinkTTL        time.Duration

	ResendAPIKey string
	EmailFrom    string
	EmailReplyTo string

	SolanaCluster string
	SolanaRPCURL  string

	StorageEndpoint  string
	StorageBucket    string
	StorageRegion    string
	StorageKeyID     string
	StorageSecret    string
	StoragePublicURL string
	UploadMaxBytes   int64
	UploadURLTTL     time.Duration

	RateLimitAnon int
	RateLimitAuth int
	// The per-endpoint budgets. Each route is charged against one of these
	// rather than against a single API-wide number; see server/budgets.go.
	RateLimitEngage int
	RateLimitWrite  int
	RateLimitUpload int
	RateLimitDonate int
	RateLimitAdmin  int
	// RateLimitIPCeiling is a deliberately generous per-address ceiling applied
	// before the session is resolved. It exists only to bound the work an
	// address can cause ahead of authentication; the meaningful budget is the
	// per-caller one applied afterwards.
	RateLimitIPCeiling int
}

// IsProduction reports whether relaxed development behaviour is forbidden.
func (c Config) IsProduction() bool { return c.Env == "production" }

// loadDotEnv finds and loads .env from current or parent directories if not already set.
func loadDotEnv() {
	paths := []string{".env", "../.env", "../../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				idx := strings.IndexByte(line, '=')
				if idx <= 0 {
					continue
				}
				key := strings.TrimSpace(line[:idx])
				val := strings.TrimSpace(line[idx+1:])
				if strings.HasPrefix(val, `"`) {
					if end := strings.LastIndex(val, `"`); end > 0 {
						val = val[1:end]
					}
				} else if strings.HasPrefix(val, `'`) {
					if end := strings.LastIndex(val, `'`); end > 0 {
						val = val[1:end]
					}
				} else {
					if commentIdx := strings.Index(val, "#"); commentIdx != -1 {
						val = strings.TrimSpace(val[:commentIdx])
					}
				}
				if _, exists := os.LookupEnv(key); !exists {
					_ = os.Setenv(key, val)
				}
			}
			break
		}
	}
}

// Load reads configuration from the environment and validates it.
func Load() (Config, error) {
	loadDotEnv()

	c := Config{
		Env:      env("APP_ENV", "development"),
		LogLevel: env("LOG_LEVEL", "info"),

		Port:         env("API_PORT", env("PORT", "8085")),
		PublicAPIURL: env("API_PUBLIC_URL", "http://localhost:8085"),
		WebURL:       env("WEB_PUBLIC_URL", "http://localhost:3000"),
		AdminURL:     env("ADMIN_PUBLIC_URL", "http://localhost:3002"),

		DatabaseURL:      os.Getenv("DATABASE_URL"),
		DatabaseMaxConns: int32(envInt("DATABASE_MAX_CONNS", 10)),

		SessionSecret:       []byte(os.Getenv("SESSION_SECRET")),
		SessionCookieName:   env("SESSION_COOKIE_NAME", "sardhana_session"),
		CookieDomain:        strings.TrimSpace(os.Getenv("SESSION_COOKIE_DOMAIN")),
		InternalProxySecret: os.Getenv("INTERNAL_PROXY_SECRET"),
		AdminSessionMaxAge:  time.Duration(envInt("ADMIN_SESSION_MAX_AGE_HOURS", 12)) * time.Hour,
		SessionTTL:          time.Duration(envInt("SESSION_TTL_HOURS", 720)) * time.Hour,
		MagicLinkTTL:        time.Duration(envInt("MAGIC_LINK_TTL_MINUTES", 15)) * time.Minute,

		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		EmailFrom:    env("EMAIL_FROM", "Sardhana <login@localhost>"),
		EmailReplyTo: os.Getenv("EMAIL_REPLY_TO"),

		SolanaCluster: env("SOLANA_CLUSTER", "devnet"),
		SolanaRPCURL:  env("SOLANA_RPC_URL", "https://api.devnet.solana.com"),

		StorageEndpoint:  os.Getenv("STORAGE_ENDPOINT"),
		StorageBucket:    os.Getenv("STORAGE_BUCKET"),
		StorageRegion:    env("STORAGE_REGION", "us-east-1"),
		StorageKeyID:     os.Getenv("STORAGE_ACCESS_KEY_ID"),
		StorageSecret:    os.Getenv("STORAGE_SECRET_ACCESS_KEY"),
		StoragePublicURL: os.Getenv("STORAGE_PUBLIC_BASE_URL"),
		UploadMaxBytes:   int64(envInt("UPLOAD_MAX_BYTES", 2<<30)),
		UploadURLTTL:     time.Duration(envInt("UPLOAD_URL_TTL_MINUTES", 15)) * time.Minute,

		RateLimitAnon: envInt("RATE_LIMIT_ANON", 300),
		// Sign-in attempts get their own, far tighter budget than page traffic.
		RateLimitAuth: envInt("RATE_LIMIT_AUTH_ATTEMPTS", 5),
		// Per-endpoint budgets. A feed read is cheap and a page render can fan
		// out into several, so read/write stay generous; issuing an upload URL,
		// recording a sponsorship and consuming a sign-in token are the
		// expensive paths and are budgeted tightly.
		RateLimitEngage: envInt("RATE_LIMIT_ENGAGE", 60),
		RateLimitWrite:  envInt("RATE_LIMIT_WRITE", 60),
		RateLimitUpload: envInt("RATE_LIMIT_UPLOAD", 10),
		RateLimitDonate: envInt("RATE_LIMIT_DONATE", 10),
		RateLimitAdmin:  envInt("RATE_LIMIT_ADMIN", 240),
		// Ten times the per-caller budget: an office or a shared connection
		// should not be throttled as if it were one person, but a single
		// address still cannot make unbounded work.
		RateLimitIPCeiling: envInt("RATE_LIMIT_IP_CEILING", 1200),
	}

	origins := env("CORS_ALLOWED_ORIGINS", c.WebURL+","+c.AdminURL)
	for _, o := range strings.Split(origins, ",") {
		if o = strings.TrimSpace(strings.TrimRight(o, "/")); o != "" {
			c.AllowedOrigins = append(c.AllowedOrigins, o)
		}
	}

	networks, err := parseNetworks(os.Getenv("ADMIN_ALLOWED_IPS"))
	if err != nil {
		return c, err
	}
	c.AdminNetworks = networks

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
	if c.InternalProxySecret != "" && len(c.InternalProxySecret) < 32 {
		problems = append(problems, "INTERNAL_PROXY_SECRET must be at least 32 bytes")
	}
	if c.CookieDomain != "" {
		host := strings.TrimPrefix(strings.TrimPrefix(c.WebURL, "https://"), "http://")
		host, _, _ = strings.Cut(host, "/")
		host, _, _ = strings.Cut(host, ":")
		domain := strings.TrimPrefix(c.CookieDomain, ".")
		if host != domain && !strings.HasSuffix(host, "."+domain) {
			problems = append(problems, "SESSION_COOKIE_DOMAIN must contain the WEB_PUBLIC_URL host")
		}
	}
	// A cookie name is written into a Set-Cookie header verbatim, so a name that
	// is not an RFC 6265 token can inject attributes — a ";" or a space turns
	// the rest of the name into something the browser reads as flags. The
	// derived CSRF cookie shares the name, so this covers both.
	if !isCookieToken(c.SessionCookieName) {
		problems = append(problems, "SESSION_COOKIE_NAME must be a valid cookie name (letters, digits and !#$%&'*+-.^_`|~ only)")
	}
	for _, b := range []struct {
		name  string
		value int
	}{
		{"DATABASE_MAX_CONNS", int(c.DatabaseMaxConns)},
		{"RATE_LIMIT_ANON", c.RateLimitAnon},
		{"RATE_LIMIT_AUTH_ATTEMPTS", c.RateLimitAuth},
		{"RATE_LIMIT_ENGAGE", c.RateLimitEngage},
		{"RATE_LIMIT_WRITE", c.RateLimitWrite},
		{"RATE_LIMIT_UPLOAD", c.RateLimitUpload},
		{"RATE_LIMIT_DONATE", c.RateLimitDonate},
		{"RATE_LIMIT_ADMIN", c.RateLimitAdmin},
		{"RATE_LIMIT_IP_CEILING", c.RateLimitIPCeiling},
	} {
		if b.value < 1 {
			problems = append(problems, b.name+" must be at least 1")
		}
	}
	if c.DatabaseMaxConns > 100 {
		problems = append(problems, "DATABASE_MAX_CONNS above 100 will exhaust a pooled endpoint; use a higher-tier pool instead")
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
		// Creator records, donations and session digests cross this connection.
		// pgx would happily negotiate TLS if the server offered it and fall back
		// to plaintext if it did not, so production asks for it explicitly
		// rather than trusting the default.
		if mode := sslMode(c.DatabaseURL); mode == "disable" || mode == "allow" || mode == "prefer" || mode == "" {
			problems = append(problems, "DATABASE_URL must set sslmode=require (or verify-full) in production")
		}
	}

	if len(problems) > 0 {
		return fmt.Errorf("configuration invalid:\n  - %s", strings.Join(problems, "\n  - "))
	}
	return nil
}

// isCookieToken reports whether name is a valid RFC 6265 cookie-name: one or
// more token characters, and nothing else.
func isCookieToken(name string) bool {
	if name == "" {
		return false
	}
	const extra = "!#$%&'*+-.^_`|~"
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
		case strings.ContainsRune(extra, r):
		default:
			return false
		}
	}
	return true
}

// sslMode reads the sslmode parameter out of a connection string without
// parsing it as a URL: DSNs come in both URL and key=value form, and only the
// value is needed here.
func sslMode(dsn string) string {
	lower := strings.ToLower(dsn)
	i := strings.Index(lower, "sslmode=")
	if i < 0 {
		return ""
	}
	value := lower[i+len("sslmode="):]
	if end := strings.IndexAny(value, "& \t"); end >= 0 {
		value = value[:end]
	}
	return value
}

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

// parseNetworks reads a comma-separated list of addresses and CIDR ranges.
func parseNetworks(raw string) ([]netip.Prefix, error) {
	var out []netip.Prefix
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if strings.Contains(part, "/") {
			p, err := netip.ParsePrefix(part)
			if err != nil {
				return nil, fmt.Errorf("ADMIN_ALLOWED_IPS: %q is not a valid range", part)
			}
			out = append(out, p.Masked())
			continue
		}
		a, err := netip.ParseAddr(part)
		if err != nil {
			return nil, fmt.Errorf("ADMIN_ALLOWED_IPS: %q is not a valid address", part)
		}
		out = append(out, netip.PrefixFrom(a.Unmap(), a.Unmap().BitLen()))
	}
	return out, nil
}
