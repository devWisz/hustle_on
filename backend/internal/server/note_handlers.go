package server

import (
	"net/http"

	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

// This file is the viewer's own writing: peer notes on somebody else's work and
// the reader's private saved list.
//
// Reading a thread needs no account — a signed-out visitor sees exactly the same
// notes, with no vote of their own and no way to add one. Everything that writes
// goes through requireUser, and every write carries the CSRF check, so a page
// that merely embeds one of these endpoints cannot make a browser use them.

// publishedTimelapse resolves a slug to a timelapse the public may see, or the
// same not-found a stranger would get for a slug that does not exist.
//
// Drafts, rejections and takedowns all collapse into that one answer on purpose:
// whether a given slug is an unpublished draft is not something an anonymous
// caller should be able to probe.
func (s *Server) publishedTimelapse(r *http.Request, slug string) (domain.Timelapse, error) {
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

// viewerID is the signed-in caller's id, or the empty string when there is none.
func viewerID(r *http.Request) string {
	if u, ok := currentUser(r); ok {
		return u.ID
	}
	return ""
}

// --- peer notes -----------------------------------------------------------

// handleTimelapseNotes lists the notes on a published timelapse.
func (s *Server) handleTimelapseNotes(w http.ResponseWriter, r *http.Request) error {
	t, err := s.publishedTimelapse(r, r.PathValue("slug"))
	if err != nil {
		return err
	}
	notes, err := s.store.TimelapseNotes(r.Context(), t.ID, viewerID(r),
		queryInt(r, "limit", 100, 1, 200))
	if err != nil {
		return storeErr(err, "Note")
	}

	// Who may remove a note is decided here, once, rather than being inferred by
	// each client from an author id it would otherwise have to be trusted with.
	u, signedIn := currentUser(r)
	isAdmin := signedIn && u.Role == roleAdmin
	for i := range notes {
		notes[i].ViewerCanDelete = isAdmin || (signedIn && notes[i].Author.ID == u.ID)
	}

	return writeJSON(w, http.StatusOK, map[string]any{"items": notes})
}

type noteBody struct {
	Body string `json:"body"`
	// Optional. A pointer so that "no timestamp" and "timestamp zero" are
	// distinguishable, which they are to a reader scrubbing a timeline.
	TimestampSeconds *int `json:"timestampSeconds"`
}

// handleCreateNote adds a note to a published timelapse.
func (s *Server) handleCreateNote(w http.ResponseWriter, r *http.Request) error {
	u, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body noteBody
	if err := decode(r, &body); err != nil {
		return err
	}

	text := validate.CleanText(body.Body)
	v := validate.New().Length("body", text, 2, 2000)
	if body.TimestampSeconds != nil {
		v.Range("timestampSeconds", *body.TimestampSeconds, 0, 86400)
	}
	if v.Any() {
		return v.Err()
	}

	t, err := s.publishedTimelapse(r, r.PathValue("slug"))
	if err != nil {
		return err
	}

	note, err := s.store.CreateNote(r.Context(), t.ID, u.ID, text, body.TimestampSeconds)
	if err != nil {
		return storeErr(err, "Note")
	}
	return writeJSON(w, http.StatusCreated, note)
}

type voteBody struct {
	Helpful bool `json:"helpful"`
}

// handleVoteNote records or withdraws the caller's "helpful" mark.
//
// The caller sends the state it wants rather than a toggle, so a double-click or
// a retried request converges on the same answer instead of flipping twice.
func (s *Server) handleVoteNote(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireUser(r); err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	noteID := r.PathValue("noteId")
	if !validate.IsUUID(noteID) {
		return apierr.NotFound("Note")
	}
	if _, err := s.publishedTimelapse(r, r.PathValue("slug")); err != nil {
		return err
	}
	var body voteBody
	if err := decode(r, &body); err != nil {
		return err
	}

	u, _ := currentUser(r)
	count, err := s.store.SetNoteVote(r.Context(), noteID, u.ID, body.Helpful)
	if err != nil {
		return storeErr(err, "Note")
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"helpfulCount":   count,
		"viewerHasVoted": body.Helpful,
	})
}

// handleDeleteNote removes a note. Its author may always remove it; an admin
// removing somebody else's is a moderation action and is written to the audit
// log, because a note disappearing without a record is indistinguishable from a
// bug.
func (s *Server) handleDeleteNote(w http.ResponseWriter, r *http.Request) error {
	u, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	noteID := r.PathValue("noteId")
	if !validate.IsUUID(noteID) {
		return apierr.NotFound("Note")
	}
	if _, err := s.publishedTimelapse(r, r.PathValue("slug")); err != nil {
		return err
	}

	note, err := s.store.NoteByID(r.Context(), noteID, u.ID)
	if err != nil {
		return storeErr(err, "Note")
	}

	asAdmin := u.Role == roleAdmin && note.Author.ID != u.ID
	if err := s.store.DeleteNote(r.Context(), noteID, u.ID, asAdmin); err != nil {
		return storeErr(err, "Note")
	}
	if asAdmin {
		s.audit(r, u.ID, "note.delete", "note", noteID, map[string]any{"authorId": note.Author.ID})
	}
	return noContent(w)
}

// --- bookmarks ------------------------------------------------------------

// handleMyBookmarks lists the caller's saved work.
func (s *Server) handleMyBookmarks(w http.ResponseWriter, r *http.Request) error {
	u, err := requireUser(r)
	if err != nil {
		return err
	}
	items, err := s.store.Bookmarks(r.Context(), u.ID, queryInt(r, "limit", 100, 1, 200))
	if err != nil {
		return storeErr(err, "Bookmark")
	}
	return writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// handleAddBookmark saves a published timelapse to the caller's list.
//
// PUT rather than POST because saving is idempotent: the resource is the pair of
// this account and this timelapse, and asking for it to be saved twice leaves
// exactly the same state as asking once.
func (s *Server) handleAddBookmark(w http.ResponseWriter, r *http.Request) error {
	u, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	slug := r.PathValue("slug")
	if _, err := s.publishedTimelapse(r, slug); err != nil {
		return err
	}
	if err := s.store.AddBookmark(r.Context(), u.ID, slug); err != nil {
		return storeErr(err, "Timelapse")
	}
	return noContent(w)
}

// handleRemoveBookmark unsaves a timelapse.
//
// Deliberately not routed through publishedTimelapse: a reader must be able to
// clear a saved item that has since been unpublished, or it would be stuck on
// their list with no way to remove it.
func (s *Server) handleRemoveBookmark(w http.ResponseWriter, r *http.Request) error {
	u, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	slug := r.PathValue("slug")
	if !validate.IsSlug(slug) {
		return apierr.NotFound("Timelapse")
	}
	if err := s.store.RemoveBookmark(r.Context(), u.ID, slug); err != nil {
		return storeErr(err, "Bookmark")
	}
	return noContent(w)
}
