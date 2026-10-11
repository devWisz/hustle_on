package server

import (
	"errors"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
	"net/http"
	"strconv"
	"time"
)

var reportReasons = map[string]bool{
	"spam": true, "not_their_work": true, "misleading": true,
	"inappropriate": true, "harassment": true, "other": true,
}

type reportBody struct {
	Slug    string `json:"slug"`
	NoteID  string `json:"noteId"`
	Reason  string `json:"reason"`
	Details string `json:"details"`
}

func (s *Server) handleCreateReport(w http.ResponseWriter, r *http.Request) error {
	u, err := requireUser(r)
	if err != nil {
		return err
	}
	var body reportBody
	if err := decode(r, &body); err != nil {
		return err
	}
	details := validate.CleanText(body.Details)
	v := validate.New().Length("details", details, 0, 1000)
	if !reportReasons[body.Reason] {
		v.Add("reason", "Choose a reason from the list.")
	}
	if body.NoteID != "" && !validate.IsUUID(body.NoteID) {
		return apierr.NotFound("Note")
	}
	if v.Any() {
		return v.Err()
	}
	t, err := s.publishedTimelapse(r, body.Slug)
	if err != nil {
		return err
	}
	err = s.store.CreateReport(r.Context(), store.NewReport{
		ReporterID: u.ID, TimelapseID: t.ID, NoteID: body.NoteID, Reason: body.Reason, Details: details,
	})
	switch {
	case errors.Is(err, store.ErrNotFound):
		return apierr.NotFound("Note")
	case errors.Is(err, store.ErrConflict):
		return apierr.Conflict("You have already reported this. An admin will look at it.")
	case err != nil:
		return storeErr(err, "Report")
	}
	return writeJSON(w, http.StatusCreated, map[string]any{"status": "open"})
}

func (s *Server) handleAdminReports(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireAdmin(r); err != nil {
		return err
	}
	status := queryString(r, "status", 20)
	switch status {
	case "", "open", "resolved", "dismissed":
	default:
		return apierr.BadRequest("Unknown status filter.")
	}
	page, err := s.store.Reports(r.Context(), status, pageQuery(r, 100, 300))
	if err != nil {
		return listErr(err, "Reports")
	}
	return writeJSON(w, http.StatusOK, page)
}

type resolveBody struct {
	Status string `json:"status"`
	Note   string `json:"note"`
}

func (s *Server) handleResolveReport(w http.ResponseWriter, r *http.Request) error {
	admin, err := requireAdmin(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Report")
	}
	var body resolveBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if body.Status != "resolved" && body.Status != "dismissed" {
		return apierr.BadRequest("Status must be resolved or dismissed.")
	}
	note := validate.CleanText(body.Note)
	if v := validate.New().Length("note", note, 0, 500); v.Any() {
		return v.Err()
	}
	title, err := s.store.ResolveReport(r.Context(), id, admin.ID, body.Status, time.Now().UTC())
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return apierr.Conflict("That report has already been closed.")
		}
		return storeErr(err, "Report")
	}
	meta := map[string]any{"title": title}
	if note != "" {
		meta["note"] = note
	}
	action := map[string]string{"resolved": "report.resolve", "dismissed": "report.dismiss"}[body.Status]
	s.audit(r, admin.ID, action, "report", id, meta)
	return noContent(w)
}

func (s *Server) handleFeature(featured bool) handler {
	return func(w http.ResponseWriter, r *http.Request) error {
		admin, err := requireAdmin(r)
		if err != nil {
			return err
		}
		id := r.PathValue("id")
		if !validate.IsUUID(id) {
			return apierr.NotFound("Timelapse")
		}
		title, err := s.store.SetFeatured(r.Context(), id, featured, time.Now().UTC())
		switch {
		case errors.Is(err, store.ErrNotFound):
			return apierr.NotFound("Timelapse")
		case errors.Is(err, store.ErrNotPublished):
			return apierr.Conflict("Only published sessions can be featured.")
		case errors.Is(err, store.ErrShelfFull):
			// Naming the limit turns a refusal into something the operator can act
			// on: they can see there is nothing wrong with this session, only that
			// the shelf is full.
			return apierr.Conflict("The front page already holds " +
				strconv.Itoa(store.MaxFeatured) + " sessions. Take one off before adding another.")
		case err != nil:
			return storeErr(err, "Timelapse")
		}
		action := "timelapse.unfeature"
		if featured {
			action = "timelapse.feature"
		}
		s.audit(r, admin.ID, action, "timelapse", id, map[string]any{"title": title})
		return noContent(w)
	}
}

func (s *Server) handleFeatured(w http.ResponseWriter, r *http.Request) error {
	items, err := s.store.Featured(r.Context(), queryInt(r, "limit", 6, 1, 12))
	if err != nil {
		return storeErr(err, "Featured")
	}
	for i := range items {
		redactForPublic(&items[i])
	}
	return writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
