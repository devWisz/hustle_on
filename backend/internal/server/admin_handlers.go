package server

import (
	"context"
	"net/http"
	"time"

	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

// The admin surface covers live stats, a database health ping, directory
// lists for accounts/sessions/roles, the report queue, and one action to
// resolve a report. Every call requires an elevated role and every decision
// is written to audit_log.

func (s *Server) handlePublicStats(w http.ResponseWriter, r *http.Request) error {
	stats, err := s.store.PublicStats(r.Context())
	if err != nil {
		return storeErr(err, "Stats")
	}
	return writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleAdminStats(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireRole(r, "admin", "moderator"); err != nil {
		return err
	}
	stats, err := s.store.Stats(r.Context())
	if err != nil {
		return storeErr(err, "Stats")
	}
	return writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleAdminHealth(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireRole(r, "admin", "moderator"); err != nil {
		return err
	}
	start := time.Now()
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	err := s.store.Pool().Ping(ctx)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return writeJSON(w, http.StatusOK, map[string]any{
			"database":  "unreachable",
			"latencyMs": latency,
			"env":       s.cfg.Env,
			"cluster":   s.chain.Cluster(),
		})
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"database":  "connected",
		"latencyMs": latency,
		"env":       s.cfg.Env,
		"cluster":   s.chain.Cluster(),
	})
}

func (s *Server) handleAdminUsers(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireRole(r, "admin", "moderator"); err != nil {
		return err
	}
	users, err := s.store.AdminUsers(r.Context(),
		queryString(r, "q", 80),
		queryInt(r, "limit", 50, 1, 200),
		queryInt(r, "offset", 0, 0, 5000))
	if err != nil {
		return storeErr(err, "Users")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.AdminUser]{Items: users})
}

func (s *Server) handleAdminVideos(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireRole(r, "admin", "moderator"); err != nil {
		return err
	}
	videos, err := s.store.AdminVideos(r.Context(),
		queryString(r, "q", 80),
		queryInt(r, "limit", 50, 1, 200),
		queryInt(r, "offset", 0, 0, 5000))
	if err != nil {
		return storeErr(err, "Videos")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Video]{Items: videos})
}

func (s *Server) handleAdminJobs(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireRole(r, "admin", "moderator"); err != nil {
		return err
	}
	jobs, err := s.store.AdminJobs(r.Context(),
		queryString(r, "q", 80),
		queryInt(r, "limit", 50, 1, 200),
		queryInt(r, "offset", 0, 0, 5000))
	if err != nil {
		return storeErr(err, "Jobs")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Job]{Items: jobs})
}

func (s *Server) handleAdminReports(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireRole(r, "admin", "moderator"); err != nil {
		return err
	}
	reports, err := s.store.ModerationQueue(r.Context(),
		queryInt(r, "limit", 50, 1, 200), queryInt(r, "offset", 0, 0, 5000))
	if err != nil {
		return storeErr(err, "Reports")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Report]{Items: reports})
}

type resolveReportBody struct {
	Action string `json:"action"`
	Note   string `json:"note"`
}

var validModerationActions = map[string]bool{
	"none": true, "content_hidden": true, "content_removed": true,
	"user_warned": true, "user_suspended": true, "user_banned": true,
}

func (s *Server) handleResolveReport(w http.ResponseWriter, r *http.Request) error {
	moderator, err := requireRole(r, "admin", "moderator")
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Report")
	}
	var body resolveReportBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if !validModerationActions[body.Action] {
		return apierr.Validation("Choose a valid action.").WithField("action", "Not a valid action.")
	}
	// Suspending or banning an account is an admin decision; moderators can
	// act on content but not on people.
	if moderator.Role != "admin" &&
		(body.Action == "user_suspended" || body.Action == "user_banned") {
		return apierr.Forbidden("Only an admin can suspend or ban an account.")
	}

	note := validate.CleanText(body.Note)
	if err := s.store.ResolveReport(r.Context(), id, moderator.ID, body.Action, note); err != nil {
		return storeErr(err, "Report")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"status": "resolved", "action": body.Action})
}
