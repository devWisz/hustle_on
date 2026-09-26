package server

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/internal/validate"
	"github.com/sardhana/backend/pkg/apierr"
)

type updateMeBody struct {
	DisplayName *string `json:"displayName"`
	Bio         *string `json:"bio"`
	Handle      *string `json:"handle"`
}

// handleUpdateMe applies a partial profile update.
//
// Every field is a pointer so an absent key means "leave this alone". A form
// that submits only the bio must not blank the display name.
func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	var body updateMeBody
	if err := decode(r, &body); err != nil {
		return err
	}

	v := validate.New()
	var up store.ProfileUpdate
	if body.DisplayName != nil {
		name := validate.CleanText(*body.DisplayName)
		v.Length("displayName", name, 1, 60)
		up.DisplayName = &name
	}
	if body.Bio != nil {
		bio := validate.CleanText(*body.Bio)
		v.Length("bio", bio, 0, 600)
		up.Bio = &bio
	}
	if body.Handle != nil {
		handle := strings.ToLower(strings.TrimSpace(*body.Handle))
		v.Handle("handle", handle)
		up.Handle = &handle
	}
	if v.Any() {
		return v.Err()
	}

	self, err := s.store.UpdateProfile(r.Context(), user.ID, up)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			return apierr.Conflict("That handle is already taken.").
				WithField("handle", "That handle is already taken.")
		}
		return storeErr(err, "Profile")
	}
	return writeJSON(w, http.StatusOK, self)
}

// --- local object storage -------------------------------------------------
//
// These two handlers stand in for a bucket during development so the upload
// flow can be exercised end to end without S3 credentials. routes() only
// registers them when no real bucket is configured.

const localUploadRoot = "data/uploads"

func (s *Server) handleLocalUpload(w http.ResponseWriter, r *http.Request) error {
	path, err := localUploadPath(r.PathValue("key"))
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return apierr.Internal(err)
	}
	out, err := os.Create(path)
	if err != nil {
		return apierr.Internal(err)
	}
	defer out.Close()

	// The same ceiling the presigned URL would have enforced, so development
	// behaves like production rather than accepting an unbounded stream.
	if _, err := io.Copy(out, io.LimitReader(r.Body, s.cfg.UploadMaxBytes)); err != nil {
		return apierr.Internal(err)
	}
	return noContent(w)
}

func (s *Server) handleServeLocalUpload(w http.ResponseWriter, r *http.Request) error {
	path, err := localUploadPath(r.PathValue("key"))
	if err != nil {
		return err
	}
	if _, err := os.Stat(path); err != nil {
		return apierr.NotFound("File")
	}
	http.ServeFile(w, r, path)
	return nil
}

// localUploadPath resolves a storage key to a path inside the upload root, and
// refuses anything that would climb out of it.
func localUploadPath(key string) (string, error) {
	if key == "" {
		return "", apierr.NotFound("File")
	}
	clean := filepath.Clean("/" + key)
	path := filepath.Join(localUploadRoot, clean)
	if !strings.HasPrefix(path, localUploadRoot+string(filepath.Separator)) {
		return "", apierr.NotFound("File")
	}
	return path, nil
}
