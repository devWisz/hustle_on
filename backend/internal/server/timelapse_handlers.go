package server

import (
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/media"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

// --- public reads ---------------------------------------------------------

// handleFeed returns published timelapses, newest first.
func (s *Server) handleFeed(w http.ResponseWriter, r *http.Request) error {
	page, err := s.store.Feed(r.Context(),
		queryString(r, "cursor", 200), queryInt(r, "limit", 12, 1, 50))
	if err != nil {
		if errors.Is(err, store.ErrBadCursor) {
			return apierr.BadRequest("That page cursor is not valid.")
		}
		return storeErr(err, "Feed")
	}
	for i := range page.Items {
		redactForPublic(&page.Items[i])
	}
	return writeJSON(w, http.StatusOK, page)
}

// handleTimelapse returns one timelapse.
//
// An unpublished row is visible to its creator and to an admin, and to nobody
// else. The 404 for everyone else is deliberate: a submission waiting on review
// should not be discoverable by guessing its slug.
func (s *Server) handleTimelapse(w http.ResponseWriter, r *http.Request) error {
	slug := r.PathValue("slug")
	if !validate.IsSlug(slug) {
		return apierr.NotFound("Timelapse")
	}
	t, err := s.store.BySlug(r.Context(), slug)
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	if t.Status != "published" {
		user, ok := currentUser(r)
		if !ok || (user.ID != t.Creator.ID && user.Role != roleAdmin) {
			return apierr.NotFound("Timelapse")
		}
		return writeJSON(w, http.StatusOK, t)
	}
	redactForPublic(&t)
	return writeJSON(w, http.StatusOK, t)
}

// redactForPublic drops the fields that belong to the creator and the reviewer
// rather than to a visitor. It is applied on the way out, so a field added to
// the struct is not exposed until somebody decides it should be.
func redactForPublic(t *domain.Timelapse) {
	t.ReviewNote = ""
	t.SubmittedAt = nil
}

// handleTimelapseDonations lists the supporters under a published timelapse.
func (s *Server) handleTimelapseDonations(w http.ResponseWriter, r *http.Request) error {
	t, err := s.publishedBySlug(r)
	if err != nil {
		return err
	}
	donations, err := s.store.TimelapseDonations(r.Context(), t.ID, queryInt(r, "limit", 20, 1, 100))
	if err != nil {
		return storeErr(err, "Donations")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"items": donations})
}

// handleRecordView counts a viewer, at most once per day.
func (s *Server) handleRecordView(w http.ResponseWriter, r *http.Request) error {
	t, err := s.publishedBySlug(r)
	if err != nil {
		return err
	}
	var viewerID string
	if u, ok := currentUser(r); ok {
		viewerID = u.ID
	}
	if err := s.store.RecordView(r.Context(), t.ID, viewerID, s.viewerFingerprint(r)); err != nil {
		return storeErr(err, "Timelapse")
	}
	return noContent(w)
}

// viewerFingerprint derives a stable per-day token for a signed-out viewer.
//
// It is an HMAC of the address under the session secret, salted with the date,
// so it dedupes today's refreshes without becoming a durable record of who
// watched what: tomorrow the same visitor hashes to something unrelated, and
// the address itself is never stored.
func (s *Server) viewerFingerprint(r *http.Request) []byte {
	if _, ok := currentUser(r); ok {
		return nil
	}
	mac := hmac.New(sha256.New, s.cfg.SessionSecret)
	mac.Write([]byte(time.Now().UTC().Format("2006-01-02")))
	mac.Write([]byte(clientIP(r).String()))
	return mac.Sum(nil)
}

// handleCreator returns a public profile.
func (s *Server) handleCreator(w http.ResponseWriter, r *http.Request) error {
	handle := strings.ToLower(r.PathValue("handle"))
	profile, err := s.store.PublicProfile(r.Context(), handle)
	if err != nil {
		return storeErr(err, "Creator")
	}
	return writeJSON(w, http.StatusOK, profile)
}

// handleCreatorTimelapses lists a creator's published work.
func (s *Server) handleCreatorTimelapses(w http.ResponseWriter, r *http.Request) error {
	handle := strings.ToLower(r.PathValue("handle"))
	items, err := s.store.CreatorTimelapses(r.Context(), handle, queryInt(r, "limit", 24, 1, 50))
	if err != nil {
		return storeErr(err, "Creator")
	}
	for i := range items {
		redactForPublic(&items[i])
	}
	return writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) error {
	stats, err := s.store.Stats(r.Context())
	if err != nil {
		return storeErr(err, "Stats")
	}
	return writeJSON(w, http.StatusOK, stats)
}

// publishedBySlug resolves a published timelapse or returns a 404.
func (s *Server) publishedBySlug(r *http.Request) (domain.Timelapse, error) {
	slug := r.PathValue("slug")
	if !validate.IsSlug(slug) {
		return domain.Timelapse{}, apierr.NotFound("Timelapse")
	}
	t, err := s.store.BySlug(r.Context(), slug)
	if err != nil {
		return domain.Timelapse{}, storeErr(err, "Timelapse")
	}
	if t.Status != "published" {
		return domain.Timelapse{}, apierr.NotFound("Timelapse")
	}
	return t, nil
}

// --- publishing -----------------------------------------------------------

type uploadBody struct {
	ContentType string `json:"contentType"`
	SizeBytes   int64  `json:"sizeBytes"`
}

// handleCreateUpload issues a presigned URL for the browser to upload to.
//
// The bytes never pass through this process. What the API controls is the
// destination: the key is derived from the caller's own id, and the signature
// covers it, so the URL cannot be edited into somebody else's prefix.
func (s *Server) handleCreateUpload(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body uploadBody
	if err := decode(r, &body); err != nil {
		return err
	}

	upload, err := s.media.NewUpload(user.ID, body.ContentType, body.SizeBytes)
	switch {
	case err == nil:
	case errors.Is(err, media.ErrUnsupportedType):
		return apierr.Validation("Upload an MP4, MOV, WebM or MKV file.").
			WithField("contentType", "That file type is not supported.")
	case errors.Is(err, media.ErrTooLarge):
		return apierr.Validation("That file is too large.").
			WithField("sizeBytes", "The file exceeds the upload limit.")
	default:
		return apierr.Internal(err)
	}
	return writeJSON(w, http.StatusCreated, upload)
}

type createTimelapseBody struct {
	Title          string `json:"title"`
	Summary        string `json:"summary"`
	GitHubURL      string `json:"githubUrl"`
	XURL           string `json:"xUrl"`
	StorageKey     string `json:"storageKey"`
	SessionMinutes int    `json:"sessionMinutes"`
}

// handleCreateTimelapse records a draft against an uploaded object.
func (s *Server) handleCreateTimelapse(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body createTimelapseBody
	if err := decode(r, &body); err != nil {
		return err
	}

	title := validate.CleanText(body.Title)
	summary := validate.CleanText(body.Summary)
	v := validate.New().
		Length("title", title, 3, 120).
		Length("summary", summary, 40, 4000).
		GitHubURL("githubUrl", body.GitHubURL).
		XURL("xUrl", body.XURL).
		Range("sessionMinutes", body.SessionMinutes, 1, 10080)
	if v.Any() {
		return v.Err()
	}
	// A key the caller was never issued would let one account attach its
	// submission to another account's uploaded object.
	if !s.media.OwnsKey(user.ID, body.StorageKey) {
		return apierr.Forbidden("That upload does not belong to this account.")
	}

	slug, err := s.uniqueSlug(r, title)
	if err != nil {
		return err
	}
	created, err := s.store.Create(r.Context(), store.NewTimelapse{
		UserID:         user.ID,
		Slug:           slug,
		Title:          title,
		Summary:        summary,
		GitHubURL:      strings.TrimSpace(body.GitHubURL),
		XURL:           strings.TrimSpace(body.XURL),
		StorageKey:     body.StorageKey,
		SessionMinutes: body.SessionMinutes,
	})
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	return writeJSON(w, http.StatusCreated, created)
}

// uniqueSlug derives a slug from the title and widens it until it is free.
func (s *Server) uniqueSlug(r *http.Request, title string) (string, error) {
	base := validate.Slugify(title)
	if len(base) < 6 {
		base = "session-" + base
	}
	for attempt := 0; attempt < 5; attempt++ {
		candidate := base
		if attempt > 0 {
			candidate = base + "-" + randomSuffix()
		}
		taken, err := s.store.SlugTaken(r.Context(), candidate)
		if err != nil {
			return "", storeErr(err, "Timelapse")
		}
		if !taken {
			return candidate, nil
		}
	}
	return "", apierr.Conflict("Could not allocate a URL for that title. Try a different one.")
}

type uploadedBody struct {
	SizeBytes       int64 `json:"sizeBytes"`
	DurationSeconds int   `json:"durationSeconds"`
}

// handleMarkUploaded records that the object landed and where it plays from.
func (s *Server) handleMarkUploaded(w http.ResponseWriter, r *http.Request) error {
	user, id, err := s.ownedTimelapse(r)
	if err != nil {
		return err
	}
	var body uploadedBody
	if err := decode(r, &body); err != nil {
		return err
	}

	// The key was issued to this account when the draft was created; reading it
	// back here means the playback URL is derived from the server's record
	// rather than from anything the client sends now.
	key, err := s.store.StorageKey(r.Context(), id)
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	if !s.media.OwnsKey(user.ID, key) {
		return apierr.Forbidden("That upload does not belong to this account.")
	}

	if err := s.store.MarkUploaded(r.Context(), id, user.ID,
		s.media.PublicURL(key), body.SizeBytes, body.DurationSeconds); err != nil {
		return storeErr(err, "Timelapse")
	}
	updated, err := s.store.ByID(r.Context(), id)
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	return writeJSON(w, http.StatusOK, updated)
}

// handleSubmitTimelapse sends an upload to review.
//
// This is the only door onto the public feed. Nothing here publishes anything;
// it hands the submission to a human and tells the creator so.
func (s *Server) handleSubmitTimelapse(w http.ResponseWriter, r *http.Request) error {
	user, id, err := s.ownedTimelapse(r)
	if err != nil {
		return err
	}
	if err := s.store.Submit(r.Context(), id, user.ID, time.Now().UTC()); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return apierr.Conflict("This timelapse cannot be submitted in its current state.")
		}
		return storeErr(err, "Timelapse")
	}
	updated, err := s.store.ByID(r.Context(), id)
	if err != nil {
		return storeErr(err, "Timelapse")
	}
	return writeJSON(w, http.StatusOK, updated)
}

type updateTimelapseBody struct {
	Title          *string `json:"title"`
	Summary        *string `json:"summary"`
	GitHubURL      *string `json:"githubUrl"`
	XURL           *string `json:"xUrl"`
	SessionMinutes *int    `json:"sessionMinutes"`
}

// handleUpdateTimelapse edits a draft or a rejected submission.
func (s *Server) handleUpdateTimelapse(w http.ResponseWriter, r *http.Request) error {
	user, id, err := s.ownedTimelapse(r)
	if err != nil {
		return err
	}
	var body updateTimelapseBody
	if err := decode(r, &body); err != nil {
		return err
	}

	v := validate.New()
	up := store.TimelapseUpdate{SessionMinutes: body.SessionMinutes}
	if body.Title != nil {
		title := validate.CleanText(*body.Title)
		v.Length("title", title, 3, 120)
		up.Title = &title
	}
	if body.Summary != nil {
		summary := validate.CleanText(*body.Summary)
		v.Length("summary", summary, 40, 4000)
		up.Summary = &summary
	}
	if body.GitHubURL != nil {
		v.GitHubURL("githubUrl", *body.GitHubURL)
		up.GitHubURL = body.GitHubURL
	}
	if body.XURL != nil {
		v.XURL("xUrl", *body.XURL)
		up.XURL = body.XURL
	}
	if body.SessionMinutes != nil {
		v.Range("sessionMinutes", *body.SessionMinutes, 1, 10080)
	}
	if v.Any() {
		return v.Err()
	}

	updated, err := s.store.Update(r.Context(), id, user.ID, up)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return apierr.Conflict("This timelapse can no longer be edited.")
		}
		return storeErr(err, "Timelapse")
	}
	return writeJSON(w, http.StatusOK, updated)
}

// handleDeleteTimelapse withdraws a timelapse.
func (s *Server) handleDeleteTimelapse(w http.ResponseWriter, r *http.Request) error {
	user, id, err := s.ownedTimelapse(r)
	if err != nil {
		return err
	}
	if err := s.store.Remove(r.Context(), id, user.ID); err != nil {
		return storeErr(err, "Timelapse")
	}
	return noContent(w)
}

// handleMyTimelapses lists everything the caller has, in any state.
func (s *Server) handleMyTimelapses(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	items, err := s.store.MyTimelapses(r.Context(), user.ID, queryInt(r, "limit", 50, 1, 100))
	if err != nil {
		return storeErr(err, "Timelapses")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// handleMyDonations lists what the caller has received.
func (s *Server) handleMyDonations(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	items, err := s.store.CreatorDonations(r.Context(), user.ID, queryInt(r, "limit", 50, 1, 100))
	if err != nil {
		return storeErr(err, "Donations")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// ownedTimelapse resolves the {id} path value for a mutating request, having
// first established that there is a signed-in caller and a valid CSRF token.
// Ownership itself is enforced by the store, in the same statement as the write.
func (s *Server) ownedTimelapse(r *http.Request) (user auth.User, id string, err error) {
	user, err = requireUser(r)
	if err != nil {
		return user, "", err
	}
	if err = s.checkCSRF(r); err != nil {
		return user, "", err
	}
	id = r.PathValue("id")
	if !validate.IsUUID(id) {
		return user, "", apierr.NotFound("Timelapse")
	}
	return user, id, nil
}
