package server

import (
	"context"
	"net/http"
	"time"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) error {
	return writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"env":     s.cfg.Env,
		"cluster": s.chain.Cluster(),
	})
}

// handleReady reports whether the process can actually serve traffic, which
// means checking the database rather than only that the process is alive.
func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) error {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	if err := s.store.Pool().Ping(ctx); err != nil {
		return writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"status":   "degraded",
			"database": "unreachable",
		})
	}
	return writeJSON(w, http.StatusOK, map[string]any{"status": "ready", "database": "ok"})
}
