package server

import (
	"net/http"

	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

// The admin surface is small on purpose: statistics, the report queue, and one
// action to resolve a report. Every call requires an elevated role and every
// decision is written to audit_log.

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
