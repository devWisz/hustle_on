package server

import (
	"context"
	"errors"
	"fmt"
	"html"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
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
	items, err := s.store.Reports(r.Context(), status, queryInt(r, "limit", 100, 1, 300))
	if err != nil {
		return storeErr(err, "Reports")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"items": items})
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

// SetMailer lets the server send notifications through the same mailer the
// sign-in flow uses.
func (s *Server) SetMailer(m auth.Mailer) { s.mailer = m }

// notifyDecision emails a creator about a review decision. It runs in the
// background so a slow mail provider never delays the reviewer.
func (s *Server) notifyDecision(timelapseID string, approved bool, note string) {
	if s.mailer == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		c, err := s.store.ContactForTimelapse(ctx, timelapseID)
		if err != nil {
			s.log.Error("notify decision: look up creator", "timelapse", timelapseID, "error", err)
			return
		}
		link := strings.TrimRight(s.cfg.WebURL, "/") + "/dashboard"
		subject := "Your session is live on Hustle On"
		lead := fmt.Sprintf("%q passed review and is now public.", c.Title)
		if approved {
			link = strings.TrimRight(s.cfg.WebURL, "/") + "/watch/" + c.Slug
		} else {
			subject = "Your session needs a few changes"
			lead = fmt.Sprintf("A reviewer sent %q back with a note. Fix it from your dashboard and resubmit.", c.Title)
		}
		text := fmt.Sprintf("Hi %s,\n\n%s\n\n", c.DisplayName, lead)
		htmlBody := fmt.Sprintf(`<p>Hi %s,</p><p>%s</p>`, html.EscapeString(c.DisplayName), html.EscapeString(lead))
		if note != "" {
			text += "Reviewer note: " + note + "\n\n"
			htmlBody += `<blockquote style="border-left:3px solid #e3e1db;margin:0;padding:4px 12px;color:#57554f">` + html.EscapeString(note) + `</blockquote>`
		}
		text += link + "\n"
		htmlBody += fmt.Sprintf(`<p><a href="%s" style="display:inline-block;background:#111110;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">%s</a></p>`,
			html.EscapeString(link), map[bool]string{true: "Watch it", false: "Open your dashboard"}[approved])
		if err := s.mailer.Send(ctx, auth.Message{To: c.Email, Subject: subject, Text: text, HTML: htmlBody, Tag: "review-decision"}); err != nil {
			s.log.Error("notify decision: send", "timelapse", timelapseID, "error", err)
		}
	}()
}
