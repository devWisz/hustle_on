// Command api runs the Sardhana HTTP API.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/config"
	"github.com/sardhana/backend/internal/db"
	"github.com/sardhana/backend/internal/logging"
	"github.com/sardhana/backend/internal/media"
	"github.com/sardhana/backend/internal/server"
	"github.com/sardhana/backend/internal/solana"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/worker"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := logging.New(cfg.LogLevel, cfg.Env)

	// Cancelled on SIGINT/SIGTERM, which starts the graceful shutdown below.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL, cfg.DatabaseMaxConns)
	if err != nil {
		return err
	}
	defer pool.Close()
	log.Info("database connected", "max_conns", cfg.DatabaseMaxConns)

	st := store.New(pool)

	// Without a Resend key outside production, login links are printed to the
	// log instead of emailed. config.Load refuses this combination in
	// production; here we wire whichever mailer is appropriate.
	mailer := buildMailer(cfg, log)

	authSvc, err := auth.NewService(auth.Config{
		AppURL:          cfg.WebURL,
		CookieName:      cfg.SessionCookieName,
		CookieDomain:    cfg.CookieDomain,
		Secure:          strings.HasPrefix(cfg.WebURL, "https://"),
		SessionTTL:      cfg.SessionTTL,
		MagicLinkTTL:    cfg.MagicLinkTTL,
		MaxLinksPerHour: cfg.RateLimitAuth,
		CSRFKey:         cfg.SessionSecret,
		ProductName:     "Sardhana",
	}, st, mailer)
	if err != nil {
		return err
	}

	chain := solana.New(cfg.SolanaRPCURL, cfg.SolanaCluster)

	storageEndpoint := cfg.StorageEndpoint
	storagePublicURL := cfg.StoragePublicURL
	if cfg.StorageKeyID == "replace-me" || cfg.StorageKeyID == "" {
		storageEndpoint = cfg.PublicAPIURL
		storagePublicURL = cfg.PublicAPIURL
	}

	storage := media.New(media.Config{
		Endpoint:  storageEndpoint,
		Bucket:    cfg.StorageBucket,
		Region:    cfg.StorageRegion,
		AccessKey: cfg.StorageKeyID,
		SecretKey: cfg.StorageSecret,
		PublicURL: storagePublicURL,
		MaxBytes:  cfg.UploadMaxBytes,
		URLTTL:    cfg.UploadURLTTL,
	})

	hops, _ := strconv.Atoi(os.Getenv("TRUSTED_PROXY_HOPS"))
	if hops == 0 && os.Getenv("TRUST_PROXY_HEADERS") == "true" {
		hops = 1
	}
	server.SetTrustedProxyHops(hops)
	server.SetInternalProxySecret(cfg.InternalProxySecret)
	server.SetAdminPolicy(cfg.AdminSessionMaxAge, cfg.AdminNetworks)

	// Settles donations whose confirmation call never reached us, so a donor
	// who closed the tab after signing is still credited.
	go worker.SettleDonations(ctx, log, st, chain)
	go worker.PurgeExpiredAuth(ctx, log, st)

	api := server.New(cfg, log, st, authSvc, chain, storage)
	return api.ListenAndServe(ctx)
}

// buildMailer chooses how sign-in emails leave the process, and says so at
// startup.
//
// Which mailer is in use is the single most common thing to be wrong about
// when "the email never arrived", so it is logged once, loudly, with the from
// address it will actually send as — a key that is present but paired with an
// unverified sender is indistinguishable from a missing key until you see
// both.
func buildMailer(cfg config.Config, log *slog.Logger) auth.Mailer {
	key := strings.TrimSpace(cfg.ResendAPIKey)

	switch {
	case key == "" || strings.Contains(key, "replace"):
		log.Warn("email: RESEND_API_KEY is not set — sign-in links will be printed to this log, not emailed",
			"hint", "set RESEND_API_KEY and EMAIL_FROM in .env to send real email")
		return auth.LogMailer{Out: os.Stdout}

	// Resend keys are prefixed `re_`. A value that is not is almost always a
	// different provider's key pasted into the wrong variable, which would
	// otherwise surface as an opaque 401 on the first sign-in attempt.
	case !strings.HasPrefix(key, "re_"):
		log.Error("email: RESEND_API_KEY does not look like a Resend key (expected a re_… prefix); sending will fail",
			"from", cfg.EmailFrom)

	default:
		log.Info("email: sending through Resend", "from", cfg.EmailFrom, "reply_to", cfg.EmailReplyTo)
	}

	resend := auth.NewResendMailer(key, cfg.EmailFrom, cfg.EmailReplyTo)
	if cfg.IsProduction() {
		return resend
	}
	// In development the link goes to both places: the log so a developer
	// never waits on an inbox, and Resend so a misconfiguration is visible
	// here rather than the first time somebody deploys.
	return devCompositeMailer{primary: resend, logger: auth.LogMailer{Out: os.Stdout}, log: log}
}

// devCompositeMailer writes every message to the log and also attempts a real
// send.
type devCompositeMailer struct {
	primary auth.Mailer
	logger  auth.Mailer
	log     *slog.Logger
}

// Send never fails the request: in development the link is already in the log,
// so a broken email provider must not block signing in. The provider's error is
// reported rather than discarded, because a silently swallowed 403 is exactly
// how a misconfigured sender survives all the way to production.
func (m devCompositeMailer) Send(ctx context.Context, msg auth.Message) error {
	_ = m.logger.Send(ctx, msg)
	if m.primary == nil {
		return nil
	}
	if err := m.primary.Send(ctx, msg); err != nil {
		m.log.Error("email: Resend rejected the message; the link above was not delivered",
			"error", err, "tag", msg.Tag)
	}
	return nil
}
