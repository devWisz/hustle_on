// Command api runs the Hustle On HTTP API.
package main

import (
	"context"
	"fmt"
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
	if cfg.IsProduction() && cfg.SolanaCluster != "mainnet-beta" {
		log.Warn("payments: running production on a test Solana cluster; sponsorships move test SOL only",
			"cluster", cfg.SolanaCluster)
	}

	st := store.New(pool)

	// Authentication is a wallet signature and nothing else: no email is sent,
	// no third party is involved, and there is no secret of ours that a sign-in
	// depends on. That is the whole point of the change reflected here — the
	// process no longer has an outbound mail dependency that can fail
	// independently of it.
	authSvc, err := auth.NewService(auth.Config{
		AppURL:       cfg.WebURL,
		ProductName:  "Hustle On",
		CookieName:   cfg.SessionCookieName,
		CookieDomain: cfg.CookieDomain,
		Secure:       strings.HasPrefix(cfg.WebURL, "https://"),
		SessionTTL:   cfg.SessionTTL,
		ChallengeTTL: cfg.ChallengeTTL,
		CSRFKey:      cfg.SessionSecret,
	}, st)
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
		// Posters are a separate, much smaller ceiling: every visitor to the feed
		// downloads one.
		PosterMaxBytes: cfg.UploadPosterMaxBytes,
		URLTTL:         cfg.UploadURLTTL,
	})
	store.SetMediaResolver(storage.Resolve)

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
