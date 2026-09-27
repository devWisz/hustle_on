// Package server wires the HTTP layer: routing, middleware and handlers.
package server

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/config"
	"github.com/sardhana/backend/internal/media"
	"github.com/sardhana/backend/internal/ratelimit"
	"github.com/sardhana/backend/internal/solana"
	"github.com/sardhana/backend/internal/store"
)

// Server holds everything a handler may need. Dependencies are explicit
// fields rather than package globals so tests can substitute any of them.
type Server struct {
	cfg     config.Config
	log     *slog.Logger
	store   *store.Store
	auth    *auth.Service
	chain   *solana.Client
	media   *media.Storage
	mailer  auth.Mailer
	limiter *ratelimit.Limiter
	ceil    *ratelimit.Limiter
	// budgets holds the per-endpoint allowances, keyed by budget name. See
	// budgets.go for why the limit is per class of work rather than per API.
	budgets map[string]*budget
	mux     *http.ServeMux
}

// New builds the server and registers routes.
func New(cfg config.Config, log *slog.Logger, st *store.Store, authSvc *auth.Service,
	chain *solana.Client, storage *media.Storage) *Server {
	s := &Server{
		cfg:     cfg,
		log:     log,
		store:   st,
		auth:    authSvc,
		chain:   chain,
		media:   storage,
		limiter: ratelimit.New(cfg.RateLimitAnon),
		ceil:    ratelimit.New(cfg.RateLimitIPCeiling),
		budgets: buildBudgets(cfg),
		mux:     http.NewServeMux(),
	}
	s.routes()
	return s
}

// Handler returns the fully wrapped HTTP handler.
func (s *Server) Handler() http.Handler {
	// Order matters and reads outermost first: a panic in any later layer is
	// still caught, and every request is logged with the id assigned above it.
	//
	// attachSession sits outside rateLimit so the limiter can key on who is
	// calling rather than only on where they are calling from. The price of
	// resolving the session first is one indexed lookup per request, which is
	// why ipCeiling wraps it: that is the layer that bounds what a single
	// address can make the process do before it knows who is asking.
	//
	// csrfGuard is inside rateLimit so that a flood of forged writes is still
	// counted, and outside the mux so that no handler can be reached without
	// having passed it.
	return s.recoverPanic(
		s.requestID(
			s.logRequests(
				s.cacheHeaders(
					s.securityHeaders(
						s.cors(
							s.ipCeiling(
								s.attachSession(
									s.rateLimit(
										s.csrfGuard(s.mux))))))))))
}

// ListenAndServe runs the API until the context is cancelled, then drains.
func (s *Server) ListenAndServe(ctx context.Context) error {
	srv := &http.Server{
		Addr:    ":" + s.cfg.Port,
		Handler: s.Handler(),
		// Timeouts are not optional: without them a slow client can hold a
		// connection, and eventually the process, indefinitely.
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
		ErrorLog:          slog.NewLogLogger(s.log.Handler(), slog.LevelWarn),
	}

	errCh := make(chan error, 1)
	go func() {
		s.log.Info("api listening", "addr", srv.Addr, "env", s.cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		s.log.Info("shutting down")
		return srv.Shutdown(shutdownCtx)
	}
}
