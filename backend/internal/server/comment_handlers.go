package server

import (
	"net/http"

	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

func (s *Server) handleListComments(w http.ResponseWriter, r *http.Request) error {
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
	comments, err := s.store.CommentsForVideo(r.Context(), video.ID,
		queryInt(r, "limit", 25, 1, 50), queryInt(r, "offset", 0, 0, 5000))
	if err != nil {
		return storeErr(err, "Comments")
	}
	return writeJSON(w, http.StatusOK, domain.Page[domain.Comment]{Items: comments})
}

type addCommentBody struct {
	Body     string `json:"body"`
	ParentID string `json:"parentId"`
}

func (s *Server) handleAddComment(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	slug := r.PathValue("slug")
	if !validate.IsSlug(slug) {
		return apierr.NotFound("Video")
	}
	var body addCommentBody
	if err := decode(r, &body); err != nil {
		return err
	}

	// Comment writes get a tighter budget than reads: this is the cheapest
	// endpoint to abuse and the most visible when abused.
	if !s.authLim.Allow("comment:" + user.ID) {
		return apierr.TooManyRequests("You are commenting too quickly. Wait a moment.")
	}

	text := validate.CleanText(body.Body)
	v := validate.New().Required("body", text).Length("body", text, 1, 2000)
	if body.ParentID != "" {
		v.UUID("parentId", body.ParentID)
	}
	if v.Any() {
		return v.Err()
	}

	video, err := s.store.VideoBySlug(r.Context(), slug, user.ID)
	if err != nil {
		return storeErr(err, "Video")
	}

	comment, err := s.store.AddComment(r.Context(), video.ID, user.ID, body.ParentID, text)
	if err != nil {
		return storeErr(err, "Comment")
	}
	return writeJSON(w, http.StatusCreated, comment)
}

func (s *Server) handleDeleteComment(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Comment")
	}
	if err := s.store.DeleteComment(r.Context(), id, user.ID); err != nil {
		return storeErr(err, "Comment")
	}
	return noContent(w)
}

func (s *Server) handleLikeComment(w http.ResponseWriter, r *http.Request) error {
	return s.setCommentLike(w, r, true)
}

func (s *Server) handleUnlikeComment(w http.ResponseWriter, r *http.Request) error {
	return s.setCommentLike(w, r, false)
}

func (s *Server) setCommentLike(w http.ResponseWriter, r *http.Request, like bool) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	id := r.PathValue("id")
	if !validate.IsUUID(id) {
		return apierr.NotFound("Comment")
	}
	count, err := s.store.LikeComment(r.Context(), id, user.ID, like)
	if err != nil {
		return storeErr(err, "Comment")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"likeCount": count, "liked": like})
}

type reportBody struct {
	SubjectType string `json:"subjectType"`
	SubjectID   string `json:"subjectId"`
	Reason      string `json:"reason"`
	Detail      string `json:"detail"`
}

var reportReasons = map[string]bool{
	"spam": true, "harassment": true, "sexual_content": true, "violence": true,
	"impersonation": true, "stolen_work": true, "illegal": true, "other": true,
}
var reportSubjects = map[string]bool{"video": true, "comment": true, "user": true, "job": true}

func (s *Server) handleReport(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body reportBody
	if err := decode(r, &body); err != nil {
		return err
	}

	v := validate.New().UUID("subjectId", body.SubjectID)
	if !reportSubjects[body.SubjectType] {
		v.Add("subjectType", "Choose a valid subject.")
	}
	if !reportReasons[body.Reason] {
		v.Add("reason", "Choose a reason.")
	}
	detail := validate.CleanText(body.Detail)
	v.Length("detail", detail, 0, 2000)
	if v.Any() {
		return v.Err()
	}

	if err := s.store.FileReport(r.Context(), user.ID, body.SubjectType, body.SubjectID,
		body.Reason, detail); err != nil {
		return storeErr(err, "Report")
	}
	// The response is the same whether or not this is a duplicate report, so
	// the endpoint cannot be used to probe what has already been reported.
	return writeJSON(w, http.StatusAccepted, map[string]any{
		"message": "Thanks. Our moderators will review this.",
	})
}
