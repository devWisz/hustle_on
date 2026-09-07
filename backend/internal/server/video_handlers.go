package server

import (
	cryptorand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/media"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

// handleFeed returns the public timeline, keyset paginated.
func (s *Server) handleFeed(w http.ResponseWriter, r *http.Request) error {
	limit := queryInt(r, "limit", 24, 1, 50)
	before, err := decodeCursor(r.URL.Query().Get("cursor"))
	if err != nil {
		return apierr.BadRequest("That page cursor is not valid.")
	}
	tag := queryString(r, "tag", 30)
	if tag != "" && !validate.IsTag(tag) {
		return apierr.BadRequest("That tag is not valid.")
	}

	videos, err := s.store.Feed(r.Context(), store.FeedQuery{
		Before: before,
		Tag:    tag,
		Search: queryString(r, "q", 80),
		Limit:  limit,
	})
	if err != nil {
		return storeErr(err, "Feed")
	}

	page := domain.Page[domain.Video]{Items: videos}
	if len(videos) == limit {
		last := videos[len(videos)-1]
		if last.PublishedAt != nil {
			page.NextCursor = encodeCursor(*last.PublishedAt)
		}
	}
	return writeJSON(w, http.StatusOK, page)
}

func (s *Server) handleVideo(w http.ResponseWriter, r *http.Request) error {
	slug := r.PathValue("slug")
	if !validate.IsSlug(slug) {
		return apierr.NotFound("Video")
	}
	viewerID := ""
	if u, ok := currentUser(r); ok {
		viewerID = u.ID
	}
	video, err := s.store.VideoBySlug(r.Context(), slug, viewerID)
	if err != nil {
		return storeErr(err, "Video")
	}
	return writeJSON(w, http.StatusOK, video)
}

func (s *Server) handleCreatorVideos(w http.ResponseWriter, r *http.Request) error {
	handle := strings.ToLower(r.PathValue("handle"))
	viewerID := ""
	if u, ok := currentUser(r); ok {
		viewerID = u.ID
	}
	limit := queryInt(r, "limit", 24, 1, 50)
	offset := queryInt(r, "offset", 0, 0, 5000)

	videos, err := s.store.VideosByCreator(r.Context(), handle, viewerID, limit, offset)
	if err != nil {
		return storeErr(err, "Videos")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Video]{Items: videos})
}

type uploadRequestBody struct {
	ContentType string `json:"contentType"`
	SizeBytes   int64  `json:"sizeBytes"`
}

// handleCreateUpload issues a presigned URL scoped to the caller.
func (s *Server) handleCreateUpload(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body uploadRequestBody
	if err := decode(r, &body); err != nil {
		return err
	}

	upload, err := s.media.NewUpload(user.ID, body.ContentType, body.SizeBytes)
	switch {
	case err == nil:
	case errors.Is(err, media.ErrUnsupportedType):
		return apierr.Validation("Upload an MP4, MOV, WebM or MKV file.").
			WithField("contentType", "This file type is not supported.")
	case errors.Is(err, media.ErrTooLarge):
		return apierr.Validation("That file is too large.").
			WithField("sizeBytes", "Maximum upload size is 2 GB.")
	default:
		return apierr.Internal(err)
	}
	return writeJSON(w, http.StatusCreated, upload)
}

type createVideoBody struct {
	StorageKey     string   `json:"storageKey"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	SessionMinutes int      `json:"sessionMinutes"`
	Visibility     string   `json:"visibility"`
	Tags           []string `json:"tags"`
}

var validVisibility = map[string]bool{"public": true, "unlisted": true, "private": true}

// handleCreateVideo registers a draft against an already-issued upload key.
func (s *Server) handleCreateVideo(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body createVideoBody
	if err := decode(r, &body); err != nil {
		return err
	}

	title := validate.CleanText(body.Title)
	description := validate.CleanText(body.Description)
	v := validate.New().
		Required("title", title).
		Length("title", title, 3, 120).
		Length("description", description, 0, 5000)
	if body.SessionMinutes < 0 || body.SessionMinutes > 10000 {
		v.Add("sessionMinutes", "Enter the length of the work session in minutes.")
	}
	if body.Visibility == "" {
		body.Visibility = "public"
	}
	if !validVisibility[body.Visibility] {
		v.Add("visibility", "Choose public, unlisted or private.")
	}
	// The key must be one we issued to this user; anything else would let a
	// caller attach a row to an object they do not own.
	if !s.media.OwnsKey(user.ID, body.StorageKey) {
		v.Add("storageKey", "Request an upload URL first.")
	}
	if v.Any() {
		return v.Err()
	}

	tags := []string{}
	for _, t := range body.Tags {
		t = strings.ToLower(strings.TrimSpace(t))
		if validate.IsTag(t) && len(tags) < 8 {
			tags = append(tags, t)
		}
	}

	id, err := s.store.CreateDraft(r.Context(), store.NewVideo{
		UserID:         user.ID,
		Slug:           newSlug(title),
		Title:          title,
		Description:    description,
		SessionMinutes: body.SessionMinutes,
		Visibility:     body.Visibility,
		StorageKey:     body.StorageKey,
		Tags:           tags,
	})
	if err != nil {
		return storeErr(err, "Video")
	}
	return writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

type uploadedBody struct {
	SizeBytes int64  `json:"sizeBytes"`
	Checksum  string `json:"checksumSha256"`
}

// handleMarkUploaded records that the object landed in the bucket.
func (s *Server) handleMarkUploaded(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Video")
	}
	var body uploadedBody
	if err := decode(r, &body); err != nil {
		return err
	}
	// The checksum is optional: hashing a multi-gigabyte file in the browser
	// is not always practical, and the transcoding pipeline computes it from
	// the stored object regardless. When the client does send one it must be
	// well formed, so a malformed value is rejected rather than stored.
	var checksum []byte
	if body.Checksum != "" {
		decoded, decErr := hex.DecodeString(body.Checksum)
		if decErr != nil || len(decoded) != sha256.Size {
			return apierr.Validation("That checksum is not a SHA-256 digest.").
				WithField("checksumSha256", "Expected a hex-encoded SHA-256 digest.")
		}
		checksum = decoded
	}
	if err := s.store.MarkUploaded(r.Context(), id, user.ID, body.SizeBytes, checksum); err != nil {
		return storeErr(err, "Video")
	}
	return noContent(w)
}

func (s *Server) handlePublishVideo(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Video")
	}
	if err := s.store.Publish(r.Context(), id, user.ID); err != nil {
		return storeErr(err, "Video")
	}
	return noContent(w)
}

type updateVideoBody struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Visibility  *string `json:"visibility"`
}

func (s *Server) handleUpdateVideo(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Video")
	}
	var body updateVideoBody
	if err := decode(r, &body); err != nil {
		return err
	}

	v := validate.New()
	if body.Title != nil {
		clean := validate.CleanText(*body.Title)
		body.Title = &clean
		v.Length("title", clean, 3, 120)
	}
	if body.Description != nil {
		clean := validate.CleanText(*body.Description)
		body.Description = &clean
		v.Length("description", clean, 0, 5000)
	}
	if body.Visibility != nil && !validVisibility[*body.Visibility] {
		v.Add("visibility", "Choose public, unlisted or private.")
	}
	if v.Any() {
		return v.Err()
	}

	if err := s.store.UpdateVideo(r.Context(), id, user.ID, body.Title, body.Description, body.Visibility); err != nil {
		return storeErr(err, "Video")
	}
	return noContent(w)
}

func (s *Server) handleDeleteVideo(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Video")
	}
	if err := s.store.RemoveVideo(r.Context(), id, user.ID); err != nil {
		return storeErr(err, "Video")
	}
	return noContent(w)
}

// handleRecordView counts a view at most once per viewer per day.
//
// Anonymous viewers are identified by a salted digest of address and user
// agent rather than either value itself, so the deduplication works without
// keeping anything that identifies a person.
func (s *Server) handleRecordView(w http.ResponseWriter, r *http.Request) error {
	slug := r.PathValue("slug")
	if !validate.IsSlug(slug) {
		return apierr.NotFound("Video")
	}
	viewerID := ""
	if u, ok := currentUser(r); ok {
		viewerID = u.ID
	}
	video, err := s.store.VideoBySlug(r.Context(), slug, viewerID)
	if err != nil {
		return storeErr(err, "Video")
	}

	fingerprint := viewerFingerprint(s.cfg.SessionSecret, clientIP(r).String(), userAgent(r), video.ID)
	seen, err := s.store.ViewedRecently(r.Context(), video.ID, viewerID, fingerprint)
	if err != nil {
		return storeErr(err, "Video")
	}
	if seen {
		return noContent(w)
	}
	watched := queryInt(r, "seconds", 0, 0, 86400)
	if err := s.store.RecordView(r.Context(), video.ID, viewerID, fingerprint, watched); err != nil {
		return storeErr(err, "Video")
	}
	return noContent(w)
}

func viewerFingerprint(secret []byte, ip, ua, videoID string) []byte {
	h := sha256.New()
	h.Write(secret)
	h.Write([]byte(ip))
	h.Write([]byte(ua))
	h.Write([]byte(videoID))
	h.Write([]byte(time.Now().UTC().Format("2006-01-02")))
	return h.Sum(nil)
}

// newSlug appends short entropy to a title-derived slug so two videos with the
// same name do not collide, and so slugs are not guessable in sequence.
func newSlug(title string) string {
	base := validate.Slugify(title)
	if len(base) < 3 {
		base = "session"
	}
	suffix := make([]byte, 3)
	if _, err := cryptorand.Read(suffix); err != nil {
		return base
	}
	return base + "-" + hex.EncodeToString(suffix)
}

func encodeCursor(t time.Time) string {
	return base64.RawURLEncoding.EncodeToString([]byte(t.UTC().Format(time.RFC3339Nano)))
}

func decodeCursor(raw string) (*time.Time, error) {
	if raw == "" {
		return nil, nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return nil, err
	}
	t, err := time.Parse(time.RFC3339Nano, string(decoded))
	if err != nil {
		return nil, err
	}
	return &t, nil
}
