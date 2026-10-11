package server

import (
	"errors"
	"net/http"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/pkg/apierr"
)

// startSession issues a session for an account that has just proved who it is,
// and returns the profile the client renders.
//
// Wallet sign-in, password sign-in and sign-up all end here. They used to each
// issue their own cookie, which is three places for the cookie flags, the CSRF
// token and the operator promotion to disagree — and the one that gets it wrong is
// the one nobody tests.
func (s *Server) startSession(w http.ResponseWriter, r *http.Request, user auth.User) error {
	user = s.grantAdminIfListed(r.Context(), user)

	cookie, err := s.auth.Issue(r.Context(), user, clientIP(r), userAgent(r))
	if err != nil {
		return apierr.Internal(err)
	}
	http.SetCookie(w, cookie)
	http.SetCookie(w, s.auth.CSRFCookie(s.auth.CSRFToken(cookie.Value), s.cfg.SessionTTL))

	// Read by id rather than through selfUser: the session was issued a line ago
	// and exists only in the Set-Cookie header, so this request's context still
	// has no user attached to it.
	self, err := s.store.SelfProfile(r.Context(), user.ID)
	if err != nil {
		return storeErr(err, "Profile")
	}
	return writeJSON(w, http.StatusOK, self)
}

type signUpBody struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// handleSignUp creates an account from a name, an email address and a password.
//
// The account is the same kind as one made with a wallet — it can upload, be
// reviewed and be sponsored. A wallet is only needed to receive money and can be
// linked later, so this is not a lesser registration.
//
// Nothing is emailed. There is no verification link, because the mail path was
// removed deliberately; the address is not proven, and the honest consequence is
// that a forgotten password cannot be reset. docs/auth.md says so plainly.
func (s *Server) handleSignUp(w http.ResponseWriter, r *http.Request) error {
	var body signUpBody
	if err := decode(r, &body); err != nil {
		return err
	}

	user, err := s.auth.SignUp(r.Context(), body.Name, body.Email, body.Password)
	switch {
	case err == nil:
	case errors.Is(err, auth.ErrEmailTaken):
		return apierr.Conflict("An account already exists for that email address.").
			WithField("email", "That address is already registered. Sign in instead.")
	default:
		return validationFrom(err)
	}

	if err := s.store.RecordAudit(r.Context(), user.ID, "account.signup", "user", user.ID,
		map[string]any{"method": "password"}); err != nil {
		s.log.WarnContext(r.Context(), "audit signup", "error", err)
	}
	return s.startSession(w, r, user)
}

type logInBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// handleLogIn verifies an email address and a password.
func (s *Server) handleLogIn(w http.ResponseWriter, r *http.Request) error {
	var body logInBody
	if err := decode(r, &body); err != nil {
		return err
	}

	user, err := s.auth.LogIn(r.Context(), body.Email, body.Password)
	switch {
	case err == nil:
	case errors.Is(err, auth.ErrBadCredentials):
		// One message for a wrong password, an unknown address and an account with
		// no password at all. Telling them apart is what turns this form into a
		// list of who has an account here.
		return apierr.Unauthorized("That email address and password do not match an account.")
	case errors.Is(err, auth.ErrSuspended):
		return apierr.Forbidden("This account is suspended.")
	default:
		return apierr.Internal(err)
	}

	return s.startSession(w, r, user)
}

type changePasswordBody struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// handleChangePassword sets or changes the password on the signed-in account.
//
// It is the only way a password is ever changed, because there is no reset link to
// send. It therefore also has to be safe against the one situation that matters: a
// session left open on a shared machine. The current password is required whenever
// the account already has one, so a borrowed session cannot take the account over.
func (s *Server) handleChangePassword(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	var body changePasswordBody
	if err := decode(r, &body); err != nil {
		return err
	}

	err = s.auth.SetPassword(r.Context(), user.ID, body.CurrentPassword, body.NewPassword)
	switch {
	case err == nil:
	case errors.Is(err, auth.ErrBadCredentials):
		return apierr.Validation("That is not your current password.").
			WithField("currentPassword", "That is not your current password.")
	default:
		return validationFrom(err)
	}

	if err := s.store.RecordAudit(r.Context(), user.ID, "account.password", "user", user.ID, nil); err != nil {
		s.log.WarnContext(r.Context(), "audit password change", "error", err)
	}
	// Every OTHER session is ended, and this one is kept. A password change is what
	// somebody does when they think an account is compromised, so the other sessions
	// have to go; but signing them out of the device they are holding — with no
	// reset link to get back in — would be a punishment rather than a protection.
	var current string
	if c, err := r.Cookie(s.cfg.SessionCookieName); err == nil {
		current = c.Value
	}
	if err := s.auth.RevokeOthers(r.Context(), user.ID, current); err != nil {
		s.log.WarnContext(r.Context(), "revoke other sessions after a password change", "error", err)
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"message": "Password changed. You have been signed out everywhere else.",
	})
}

// validationFrom turns a field-carrying rule failure into a 422 the form can put
// beside the right input.
func validationFrom(err error) error {
	field := auth.FieldOf(err)
	if field == "" {
		// Not a rule failure, so it is ours and not the caller's.
		return apierr.Internal(err)
	}
	return apierr.Validation(err.Error()).WithField(field, err.Error())
}
