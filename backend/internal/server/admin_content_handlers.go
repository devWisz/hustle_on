package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/sardhana/backend/internal/media"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

// This file is the operator's editing desk: correcting somebody else's
// submission, arranging the curated front page, and choosing the image that
// represents a session in the feed.
//
// An operator could already publish and unpublish. What these add is the ability
// to change what the public sees *without* a status change — a corrected title,
// a replaced poster, a rearranged shelf — which is exactly the kind of quiet
// power that has to leave a trail. Every handler here writes an audit line
// naming what changed, not merely that something did.

// adminTargetID resolves the {id} path value for an operator action.
func adminTargetID(r *http.Request) (string, error) {
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return "", apierr.NotFound("Timelapse")
	}
	return id, nil
}

type adminEditBody struct {
	Title          *string `json:"title"`
	Summary        *string `json:"summary"`
	GitHubURL      *string `json:"githubUrl"`
	XURL           *string `json:"xUrl"`
	SessionMinutes *int    `json:"sessionMinutes"`
}

// handleAdminEditTimelapse corrects the fields of any submission.
//
// The creator's own PATCH deliberately refuses once a session is in review or
// published, so a reviewer is never reading a moving target. An operator has the
// opposite need: a typo or a dead link on a live session has to be fixable
// without unpublishing it and starting again. The audit line is what makes that
// safe — the change is recorded even though no status moved.
func (s *Server) handleAdminEditTimelapse(w http.ResponseWriter, r *http.Request) error {
	admin, err := requireAdmin(r)
	if err != nil {
		return err
	}
	id, err := adminTargetID(r)
	if err != nil {
		return err
	}
	var body adminEditBody
	if err := decode(r, &body); err != nil {
		return err
	}

	v := validate.New()
	edit := store.AdminEdit{SessionMinutes: body.SessionMinutes}
	changed := make([]string, 0, 5)
	if body.Title != nil {
		title := validate.CleanText(*body.Title)
		v.Length("title", title, 3, 120)
		edit.Title = &title
		changed = append(changed, "title")
	}
	if body.Summary != nil {
		summary := validate.CleanText(*body.Summary)
		v.Length("summary", summary, 40, 4000)
		edit.Summary = &summary
		changed = append(changed, "summary")
	}
	if body.GitHubURL != nil {
		// An empty string is a real instruction here: it clears the link. That is
		// the difference between this endpoint and the creator's.
		if trimmed := strings.TrimSpace(*body.GitHubURL); trimmed != "" {
			v.GitHubURL("githubUrl", trimmed)
			edit.GitHubURL = &trimmed
		} else {
			edit.GitHubURL = body.GitHubURL
		}
		changed = append(changed, "githubUrl")
	}
	if body.XURL != nil {
		if trimmed := strings.TrimSpace(*body.XURL); trimmed != "" {
			v.XURL("xUrl", trimmed)
			edit.XURL = &trimmed
		} else {
			edit.XURL = body.XURL
		}
		changed = append(changed, "xUrl")
	}
	if body.SessionMinutes != nil {
		v.Range("sessionMinutes", *body.SessionMinutes, 1, 10080)
		changed = append(changed, "sessionMinutes")
	}
	if v.Any() {
		return v.Err()
	}
	if len(changed) == 0 {
		return apierr.BadRequest("Nothing to change.")
	}

	updated, err := s.store.AdminUpdateTimelapse(r.Context(), id, edit)
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	s.audit(r, admin.ID, "timelapse.edit", "timelapse", id, map[string]any{
		"title":  updated.Title,
		"fields": changed,
	})
	return writeJSON(w, http.StatusOK, updated)
}

type posterUploadBody struct {
	ContentType string `json:"contentType"`
	SizeBytes   int64  `json:"sizeBytes"`
}

// handleAdminPosterUpload issues a presigned URL for a poster image.
//
// It is separate from the creator's upload endpoint because posters are a
// different kind of object with a different allowlist and a much smaller ceiling
// — see media.NewPosterUpload. The key embeds the operator's own id, so the
// object can only ever be attached by the account that uploaded it.
func (s *Server) handleAdminPosterUpload(w http.ResponseWriter, r *http.Request) error {
	admin, err := requireAdmin(r)
	if err != nil {
		return err
	}
	var body posterUploadBody
	if err := decode(r, &body); err != nil {
		return err
	}
	upload, err := s.media.NewPosterUpload(admin.ID, body.ContentType, body.SizeBytes)
	switch {
	case err == nil:
	case errors.Is(err, media.ErrUnsupportedType):
		return apierr.Validation("Upload a JPEG, PNG or WebP image.").
			WithField("contentType", "That image type is not supported.")
	case errors.Is(err, media.ErrTooLarge):
		return apierr.Validation("That image is too large.").
			WithField("sizeBytes", "The image exceeds the poster limit.")
	default:
		return apierr.Internal(err)
	}
	return writeJSON(w, http.StatusCreated, upload)
}

type setThumbnailBody struct {
	Key string `json:"key"`
}

// handleAdminSetThumbnail records which poster image a session uses.
//
// The key is checked twice: it must be a poster object at all, so a session's
// video cannot be filed as its own thumbnail, and it must be one this operator
// uploaded, so knowing an object's name is not enough to attach it.
func (s *Server) handleAdminSetThumbnail(w http.ResponseWriter, r *http.Request) error {
	admin, err := requireAdmin(r)
	if err != nil {
		return err
	}
	id, err := adminTargetID(r)
	if err != nil {
		return err
	}
	var body setThumbnailBody
	if err := decode(r, &body); err != nil {
		return err
	}
	key := strings.TrimSpace(body.Key)
	if !s.media.IsPosterKey(key) {
		return apierr.Validation("Choose an uploaded poster image.").
			WithField("key", "That is not a poster image.")
	}
	if !s.media.OwnsKey(admin.ID, key) {
		return apierr.Forbidden("That image was uploaded by a different account.")
	}

	// Stored as a media reference rather than a bare URL, so a bucket that is not
	// public still works: the reference is signed on the way out, exactly like a
	// playback URL.
	title, err := s.store.SetThumbnail(r.Context(), id, s.media.PlaybackRef(key))
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	s.audit(r, admin.ID, "timelapse.thumbnail", "timelapse", id, map[string]any{
		"title": title,
		"key":   key,
	})
	return noContent(w)
}

// handleAdminClearThumbnail removes a poster, putting the session back on the
// generated placeholder rather than leaving a wrong image in place.
func (s *Server) handleAdminClearThumbnail(w http.ResponseWriter, r *http.Request) error {
	admin, err := requireAdmin(r)
	if err != nil {
		return err
	}
	id, err := adminTargetID(r)
	if err != nil {
		return err
	}
	title, err := s.store.SetThumbnail(r.Context(), id, "")
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	s.audit(r, admin.ID, "timelapse.thumbnail.clear", "timelapse", id,
		map[string]any{"title": title})
	return noContent(w)
}

// featuredBody is the whole shelf, in the order it should appear.
type featuredBody struct {
	IDs []string `json:"ids"`
}

// handleAdminFeatured returns the curated front page in its current order, with
// the capacity beside it so the console can say how many slots are free rather
// than letting an operator discover the limit by being refused.
func (s *Server) handleAdminFeatured(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireAdmin(r); err != nil {
		return err
	}
	items, err := s.store.Featured(r.Context(), store.MaxFeatured)
	if err != nil {
		return storeErr(err, "Front page")
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"items":    items,
		"capacity": store.MaxFeatured,
	})
}

// handleAdminReorderFeatured sets the order of the front page.
//
// The body is a permutation of the sessions already on the shelf, not a set of
// new ranks: membership changes go through the feature and unfeature endpoints,
// so this one can only rearrange what the operator has already chosen. A stale
// console that reorders a shelf it last saw ten minutes ago is therefore refused
// rather than silently publishing a different front page than the one on screen.
func (s *Server) handleAdminReorderFeatured(w http.ResponseWriter, r *http.Request) error {
	admin, err := requireAdmin(r)
	if err != nil {
		return err
	}
	var body featuredBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if len(body.IDs) > store.MaxFeatured {
		return apierr.BadRequest("That is more sessions than the front page holds.")
	}
	for _, id := range body.IDs {
		if !validate.IsUUID(id) {
			return apierr.NotFound("Timelapse")
		}
	}
	titles, err := s.store.ReorderFeatured(r.Context(), body.IDs)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			return apierr.Conflict("The front page changed while you were arranging it. Reload and try again.")
		}
		return storeErr(err, "Front page")
	}
	s.audit(r, admin.ID, "featured.reorder", "front_page", "",
		map[string]any{"order": titles})
	return noContent(w)
}
