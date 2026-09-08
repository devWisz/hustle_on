// Command api runs the Sardhana HTTP API.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
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
	// production, so it cannot become the deployed behaviour by accident.
	var mailer auth.Mailer
	if cfg.ResendAPIKey != "" {
		mailer = auth.NewResendMailer(cfg.ResendAPIKey, cfg.EmailFrom, cfg.EmailReplyTo)
	} else {
		log.Warn("no RESEND_API_KEY set; login links will be written to the log")
		mailer = auth.LogMailer{Out: os.Stdout}
	}

	authSvc, err := auth.NewService(auth.Config{
		AppURL:          cfg.WebURL,
		CookieName:      cfg.SessionCookieName,
		Secure:          strings.HasPrefix(cfg.WebURL, "https://"),
		SessionTTL:      cfg.SessionTTL,
		MagicLinkTTL:    cfg.MagicLinkTTL,
		MaxLinksPerHour: cfg.RateLimitAuth,
		CSRFKey:         cfg.SessionSecret,
		ProductName:     "HustlerOn",
	}, st, mailer)
	if err != nil {
		return err
	}

	chain := solana.New(cfg.SolanaRPCURL, cfg.SolanaCluster)
	storage := media.New(media.Config{
		Endpoint:  cfg.StorageEndpoint,
		Bucket:    cfg.StorageBucket,
		Region:    cfg.StorageRegion,
		AccessKey: cfg.StorageKeyID,
		SecretKey: cfg.StorageSecret,
		PublicURL: cfg.StoragePublicURL,
		MaxBytes:  cfg.UploadMaxBytes,
		URLTTL:    cfg.UploadURLTTL,
	})

	server.SetTrustProxyHeaders(os.Getenv("TRUST_PROXY_HEADERS") == "true")

	// The reconciler settles transactions whose confirmation never reached us,
	// so a sponsor closing the tab mid-flow still gets credited.
	go worker.ReconcilePayments(ctx, log, st, chain)

	api := server.New(cfg, log, st, authSvc, chain, storage)
	return api.ListenAndServe(ctx)
}
