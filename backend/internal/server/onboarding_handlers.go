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

// This file is the first thing a new account is asked to do.
//
// Signing in creates a row from an email address: a handle derived from it and a
// display name identical to that handle. That is enough to own a session and not
// enough to be credited for one — a creator's name is on every card, beside every
// recording and in the ledger when somebody sponsors them — so the site asks once,
// immediately after the address is verified, and never invents an answer it would
// then show to the public.

type onboardingBody struct {
	Handle      string `json:"handle"`
	DisplayName string `json:"displayName"`
	Bio         string `json:"bio"`
	// Optional. The key from POST /v1/uploads/avatar.
	AvatarKey string `json:"avatarKey"`
}

// handleCompleteOnboarding records the handle, name and picture an account holder
// has chosen for themselves.
//
// The handle is re-checked here rather than trusted: it becomes a public URL, so
// it is held to the same rules as every other handle on the site and refused if
// somebody already has it.
func (s *Server) handleCompleteOnboarding(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	var body onboardingBody
	if err := decode(r, &body); err != nil {
		return err
	}

	handle := strings.ToLower(strings.TrimSpace(body.Handle))
	displayName := validate.CleanText(body.DisplayName)
	bio := validate.CleanText(body.Bio)

	v := validate.New().Handle("handle", handle).Length("displayName", displayName, 1, 60)
	if bio != "" {
		v.Length("bio", bio, 1, 600)
	}
	if body.AvatarKey != "" && !s.avatarKeyAllowed(user.ID, body.AvatarKey) {
		return apierr.Validation("Choose an image you uploaded.").
			WithField("avatarKey", "That is not one of your uploaded images.")
	}
	if v.Any() {
		return v.Err()
	}

	// An avatar is stored as a media reference rather than a URL, so a bucket that
	// is not public still works: the reference is signed on the way out.
	avatarRef := ""
	if body.AvatarKey != "" {
		avatarRef = s.media.PlaybackRef(body.AvatarKey)
	}

	self, err := s.store.CompleteOnboarding(r.Context(), user.ID, handle, displayName, bio, avatarRef)
	if err != nil {
		if errors.Is(err, store.ErrConflict) {
			return apierr.Conflict("That handle is already taken.").
				WithField("handle", "That handle is already taken.")
		}
		return storeErr(err, "Profile")
	}
	s.audit(r, user.ID, "profile.onboard", "user", user.ID, map[string]any{"handle": self.Handle})
	return writeJSON(w, http.StatusOK, self)
}

// handleAvatarUpload issues a presigned URL for a profile picture.
//
// Separate from the poster endpoint because the object belongs to the account
// rather than to a session an operator curates, and the key carries the owner's
// id so it can only ever be attached by the person who uploaded it.
func (s *Server) handleAvatarUpload(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	var body posterUploadBody
	if err := decode(r, &body); err != nil {
		return err
	}
	upload, err := s.media.NewAvatarUpload(user.ID, body.ContentType, body.SizeBytes)
	switch {
	case err == nil:
	case errors.Is(err, media.ErrUnsupportedType):
		return apierr.Validation("Upload a JPEG, PNG or WebP image.").
			WithField("contentType", "That image type is not supported.")
	case errors.Is(err, media.ErrTooLarge):
		return apierr.Validation("That image is too large.").
			WithField("sizeBytes", "The image exceeds the size limit.")
	default:
		return apierr.Internal(err)
	}
	return writeJSON(w, http.StatusCreated, upload)
}

type avatarBody struct {
	Key string `json:"key"`
}

// handleSetAvatar changes the picture on an account that has already been
// onboarded. It is the settings-page counterpart to the onboarding form's field.
func (s *Server) handleSetAvatar(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	var body avatarBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if !s.avatarKeyAllowed(user.ID, body.Key) {
		return apierr.Validation("Choose an image you uploaded.").
			WithField("key", "That is not one of your uploaded images.")
	}
	self, err := s.store.SetAvatar(r.Context(), user.ID, s.media.PlaybackRef(body.Key))
	if err != nil {
		return storeErr(err, "Profile")
	}
	return writeJSON(w, http.StatusOK, self)
}

// handleClearAvatar removes the picture, putting the account back on its initials.
func (s *Server) handleClearAvatar(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	self, err := s.store.SetAvatar(r.Context(), user.ID, "")
	if err != nil {
		return storeErr(err, "Profile")
	}
	return writeJSON(w, http.StatusOK, self)
}

// avatarKeyAllowed checks that a key is an avatar object this account uploaded.
//
// Knowing an object's name must not be permission to use it: without the second
// check, any account could wear any picture in the bucket by guessing its path.
func (s *Server) avatarKeyAllowed(userID, key string) bool {
	key = strings.TrimSpace(key)
	return s.media.IsAvatarKey(key) && s.media.OwnsKey(userID, key)
}
