package server

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/pkg/apierr"
)

type requestLinkBody struct {
	Email string `json:"email"`
	Next  string `json:"next"`
}

// handleRequestLink emails a sign-in link.
//
// The reply is always the same, whatever happened: unknown address, existing
// account, suspended account. Anything else would turn this endpoint into an
// oracle for which email addresses have accounts here.
func (s *Server) handleRequestLink(w http.ResponseWriter, r *http.Request) error {
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body requestLinkBody
	if err := decode(r, &body); err != nil {
		return err
	}

	// Sign-in attempts get their own, much tighter budget than ordinary traffic.
	if !s.authLim.Allow("auth:" + clientIP(r).String()) {
		return apierr.TooManyRequests("Too many sign-in attempts. Try again shortly.")
	}

	err := s.auth.StartLogin(r.Context(), auth.LoginRequest{
		Email:     body.Email,
		IP:        clientIP(r),
		UserAgent: userAgent(r),
		Next:      body.Next,
	})
	switch {
	case err == nil:
	case errors.Is(err, auth.ErrRateLimited):
		return apierr.TooManyRequests("A link was already sent to that address. Check your inbox.")
	case strings.Contains(err.Error(), "email"):
		return apierr.Validation("Enter a valid email address.").
			WithField("email", "Enter a valid email address.")
	default:
		// A mail-delivery failure is logged, but the response stays identical so
		// the caller still learns nothing about the address.
		s.log.ErrorContext(r.Context(), "start login", "error", err)
	}

	return writeJSON(w, http.StatusAccepted, map[string]any{
		"message": "If that address has an account, a sign-in link is on its way.",
	})
}

type verifyBody struct {
	Token string `json:"token"`
}

// handleVerifyLink consumes a sign-in token and starts a session.
func (s *Server) handleVerifyLink(w http.ResponseWriter, r *http.Request) error {
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body verifyBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if !s.authLim.Allow("verify:" + clientIP(r).String()) {
		return apierr.TooManyRequests("Too many attempts. Try again shortly.")
	}

	user, err := s.auth.CompleteLogin(r.Context(), body.Token)
	if err != nil {
		return apierr.Unauthorized("That sign-in link is no longer valid. Request a new one.")
	}

	cookie, err := s.auth.Issue(r.Context(), user, clientIP(r), userAgent(r))
	if err != nil {
		return apierr.Internal(err)
	}
	http.SetCookie(w, cookie)
	http.SetCookie(w, s.auth.CSRFCookie(s.auth.CSRFToken(cookie.Value), s.cfg.SessionTTL))

	// The profile is read by id rather than through selfUser: the session was
	// issued a line ago and exists only in the Set-Cookie header, so this
	// request's context still has no user attached to it.
	self, err := s.store.SelfProfile(r.Context(), user.ID)
	if err != nil {
		return storeErr(err, "Profile")
	}
	return writeJSON(w, http.StatusOK, self)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) error {
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var value string
	if c, err := r.Cookie(s.cfg.SessionCookieName); err == nil {
		value = c.Value
	}
	cleared, err := s.auth.Revoke(r.Context(), value)
	if err != nil {
		return apierr.Internal(err)
	}
	http.SetCookie(w, cleared)
	http.SetCookie(w, s.auth.CSRFCookie("", -time.Hour))
	return noContent(w)
}

// handleSession reports who the caller is without failing when nobody is signed
// in — the frontend uses it to decide what to render.
func (s *Server) handleSession(w http.ResponseWriter, r *http.Request) error {
	if _, ok := currentUser(r); !ok {
		return writeJSON(w, http.StatusOK, map[string]any{"authenticated": false})
	}
	self, err := s.selfUser(r)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"authenticated": true, "user": self})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) error {
	if _, err := requireUser(r); err != nil {
		return err
	}
	self, err := s.selfUser(r)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, self)
}

// selfUser reads the private view of the account on this request's session.
func (s *Server) selfUser(r *http.Request) (domain.SelfUser, error) {
	user, err := requireUser(r)
	if err != nil {
		return domain.SelfUser{}, err
	}
	self, err := s.store.SelfProfile(r.Context(), user.ID)
	if err != nil {
		return domain.SelfUser{}, storeErr(err, "Profile")
	}
	return self, nil
}

type walletChallengeBody struct {
	Address string `json:"address"`
}

// handleWalletChallenge returns the message the wallet must sign.
func (s *Server) handleWalletChallenge(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body walletChallengeBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if err := auth.ValidateSolanaAddress(body.Address); err != nil {
		return apierr.Validation("That is not a valid Solana address.").
			WithField("address", "Enter a valid Solana address.")
	}

	message, nonce, err := s.auth.StartWalletLink(r.Context(), user.ID, body.Address)
	if err != nil {
		return apierr.Internal(err)
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"message":  message,
		"nonce":    nonce,
		"issuedAt": time.Now().UTC().Format(time.RFC3339),
	})
}

type walletVerifyBody struct {
	Address   string `json:"address"`
	Nonce     string `json:"nonce"`
	Signature string `json:"signature"`
	IssuedAt  string `json:"issuedAt"`
}

// handleWalletVerify checks the signature and records the payout address.
//
// This is the only way an address gets onto an account. Nothing about donations
// works until it has run, which is deliberate: money should only ever be routed
// to a key the account has demonstrated it holds.
func (s *Server) handleWalletVerify(w http.ResponseWriter, r *http.Request) error {
	user, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.checkCSRF(r); err != nil {
		return err
	}
	var body walletVerifyBody
	if err := decode(r, &body); err != nil {
		return err
	}
	issuedAt, parseErr := time.Parse(time.RFC3339, body.IssuedAt)
	if parseErr != nil {
		return apierr.BadRequest("Missing or malformed issuedAt.")
	}

	err = s.auth.CompleteWalletLink(r.Context(), user.ID, body.Address, body.Nonce,
		body.Signature, issuedAt)
	switch {
	case err == nil:
	case errors.Is(err, auth.ErrBadSignature):
		return apierr.Unauthorized("That signature does not match the wallet.")
	case errors.Is(err, auth.ErrInvalidToken):
		return apierr.BadRequest("That challenge has expired. Start again.")
	default:
		return apierr.Conflict("That wallet is already linked to another account.")
	}

	if err := s.store.RecordAudit(r.Context(), user.ID, "wallet.verify", "user", user.ID,
		map[string]any{"address": body.Address}); err != nil {
		s.log.WarnContext(r.Context(), "audit wallet verify", "error", err)
	}

	self, err := s.selfUser(r)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, self)
}
