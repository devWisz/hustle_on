package server

import (
	"errors"
	"net/http"
	"time"

	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

// Every handler in this file is gated on the admin role, and every decision one
// of them makes is written to the audit log. Between them they are the entire
// difference between an upload and something the public can see.

// handleReviewQueue lists submissions awaiting a decision, oldest first.
func (s *Server) handleReviewQueue(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireAdmin(r); err != nil {
		return err
	}
	page, err := s.store.ReviewQueue(r.Context(), pageQuery(r, 50, 100))
	if err != nil {
		return listErr(err, "Queue")
	}
	return writeJSON(w, http.StatusOK, page)
}

// handleApprove publishes a submission.
func (s *Server) handleApprove(w http.ResponseWriter, r *http.Request) error {
	reviewer, id, err := s.reviewTarget(r)
	if err != nil {
		return err
	}
	if err := s.store.Approve(r.Context(), id, reviewer.ID, time.Now().UTC()); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return apierr.Conflict("That submission is no longer awaiting review.")
		}
		return storeErr(err, "Timelapse")
	}
	updated, err := s.store.ByID(r.Context(), id)
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	s.audit(r, reviewer.ID, "timelapse.approve", "timelapse", id, map[string]any{"title": updated.Title})
	return writeJSON(w, http.StatusOK, updated)
}

type rejectBody struct {
	Note string `json:"note"`
}

// handleReject declines a submission.
//
// The note is required rather than optional: a rejection the creator cannot act
// on is worse than no answer, and the schema will not store one without it.
func (s *Server) handleReject(w http.ResponseWriter, r *http.Request) error {
	reviewer, id, err := s.reviewTarget(r)
	if err != nil {
		return err
	}
	var body rejectBody
	if err := decode(r, &body); err != nil {
		return err
	}
	note := validate.CleanText(body.Note)
	if v := validate.New().Length("note", note, 10, 500); v.Any() {
		return v.Err()
	}

	if err := s.store.Reject(r.Context(), id, reviewer.ID, note, time.Now().UTC()); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return apierr.Conflict("That submission is no longer awaiting review.")
		}
		return storeErr(err, "Timelapse")
	}
	updated, err := s.store.ByID(r.Context(), id)
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	s.audit(r, reviewer.ID, "timelapse.reject", "timelapse", id, map[string]any{"title": updated.Title, "note": note})
	return writeJSON(w, http.StatusOK, updated)
}

// handleTakeDown removes an already published timelapse.
func (s *Server) handleTakeDown(w http.ResponseWriter, r *http.Request) error {
	reviewer, id, err := s.reviewTarget(r)
	if err != nil {
		return err
	}
	// An empty owner id lets the store match the row regardless of who created
	// it, which is exactly the power this endpoint exists to grant.
	target, err := s.store.ByID(r.Context(), id)
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	if err := s.store.Remove(r.Context(), id, ""); err != nil {
		return storeErr(err, "Timelapse")
	}
	s.audit(r, reviewer.ID, "timelapse.takedown", "timelapse", id, map[string]any{"title": target.Title})
	return noContent(w)
}

// reviewTarget resolves the admin caller and the {id} they are acting on.
func (s *Server) reviewTarget(r *http.Request) (user adminUser, id string, err error) {
	u, err := requireAdmin(r)
	if err != nil {
		return user, "", err
	}
	id = r.PathValue("id")
	if !validate.IsUUID(id) {
		return user, "", apierr.NotFound("Timelapse")
	}
	return adminUser{ID: u.ID}, id, nil
}

// adminUser is the sliver of the reviewer this file needs: who to attribute the
// decision to.
type adminUser struct{ ID string }

// audit records a decision. A failure to write the trail is logged but never
// fails the request: the decision has already been applied, and reporting an
// error the caller cannot act on would only invite them to apply it twice.
func (s *Server) audit(r *http.Request, actorID, action, subjectType, subjectID string, meta map[string]any) {
	if err := s.store.RecordAudit(r.Context(), actorID, action, subjectType, subjectID, meta); err != nil {
		s.log.ErrorContext(r.Context(), "write audit log",
			"action", action, "subject", subjectID, "error", err)
	}
}

// handleAuditLog returns the most recent operator actions.
//
// The review panel shows its own history. An operator can see what was decided,
// by whom and when, which is what makes the audit table worth writing: a record
// nobody can read changes nobody's behaviour.
func (s *Server) handleAuditLog(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireAdmin(r); err != nil {
		return err
	}
	page, err := s.store.RecentAudit(r.Context(), pageQuery(r, 50, 200))
	if err != nil {
		return listErr(err, "Audit log")
	}
	return writeJSON(w, http.StatusOK, page)
}

func (s *Server) handleMembers(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireAdmin(r); err != nil {
		return err
	}
	page, err := s.store.Members(r.Context(), queryString(r, "q", 80), pageQuery(r, 100, 200))
	if err != nil {
		return listErr(err, "Members")
	}
	return writeJSON(w, http.StatusOK, page)
}

type memberStatusBody struct {
	Note string `json:"note"`
}

func (s *Server) handleMemberStatus(status string) handler {
	return func(w http.ResponseWriter, r *http.Request) error {
		admin, err := requireAdmin(r)
		if err != nil {
			return err
		}
		id := r.PathValue("id")
		if !validate.IsUUID(id) {
			return apierr.NotFound("Member")
		}
		if id == admin.ID {
			return apierr.Conflict("You cannot change the status of your own account.")
		}
		var body memberStatusBody
		if r.ContentLength != 0 {
			if err := decode(r, &body); err != nil {
				return err
			}
		}
		note := validate.CleanText(body.Note)
		if v := validate.New().Length("note", note, 0, 500); v.Any() {
			return v.Err()
		}

		name, err := s.store.SetMemberStatus(r.Context(), id, status)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				return apierr.Conflict("That member is already in that state, or is an admin.")
			}
			return storeErr(err, "Member")
		}
		if status == "suspended" {
			if err := s.auth.RevokeAll(r.Context(), id); err != nil {
				s.log.ErrorContext(r.Context(), "revoke suspended member sessions", "member", id, "error", err)
			}
		}

		action := "member.reinstate"
		if status == "suspended" {
			action = "member.suspend"
		}
		meta := map[string]any{"title": name}
		if note != "" {
			meta["note"] = note
		}
		s.audit(r, admin.ID, action, "user", id, meta)
		return noContent(w)
	}
}

func (s *Server) handleLedger(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireAdmin(r); err != nil {
		return err
	}
	status := queryString(r, "status", 20)
	switch status {
	case "", "pending", "submitted", "confirmed", "failed":
	default:
		return apierr.BadRequest("Unknown status filter.")
	}
	page, err := s.store.Ledger(r.Context(), status, pageQuery(r, 100, 200))
	if err != nil {
		return listErr(err, "Ledger")
	}
	return writeJSON(w, http.StatusOK, page)
}

// handleActivity returns one row per day for a bounded window.
//
// It is the one list endpoint without a cursor, and deliberately so: the window
// is capped at 90 days, so the response is bounded by the request itself rather
// than by a page size.
func (s *Server) handleActivity(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireAdmin(r); err != nil {
		return err
	}
	items, err := s.store.Activity(r.Context(), queryInt(r, "days", 30, 7, 90))
	if err != nil {
		return storeErr(err, "Activity")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleAdminNotes(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireAdmin(r); err != nil {
		return err
	}
	items, err := s.store.RecentNotes(r.Context(), queryInt(r, "limit", 100, 1, 200))
	if err != nil {
		return storeErr(err, "Notes")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
