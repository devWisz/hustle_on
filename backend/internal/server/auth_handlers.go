package server

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/domain"
	"github.com/sardhana/backend/pkg/apierr"
)

// signInChallengeBody carries the address that wants to sign in.
type signInChallengeBody struct {
	Address string `json:"address"`
}

// handleSignInChallenge hands the browser the exact text to have its wallet sign.
//
// It is anonymous, and that is the point: the caller is usually somebody who has
// no account yet. Nothing is looked up here, so the response is identical
// whether the address is already registered or has never been seen — which is
// what keeps this endpoint from being a directory of who has an account.
func (s *Server) handleSignInChallenge(w http.ResponseWriter, r *http.Request) error {
	var body signInChallengeBody
	if err := decode(r, &body); err != nil {
		return err
	}
	if err := auth.ValidateSolanaAddress(strings.TrimSpace(body.Address)); err != nil {
		return apierr.Validation("That is not a valid Solana address.").
			WithField("address", "Enter a valid Solana address.")
	}

	challenge, err := s.auth.StartSignIn(r.Context(), body.Address)
	switch {
	case err == nil:
	case errors.Is(err, auth.ErrRateLimited):
		return apierr.TooManyRequests("Too many sign-in attempts. Wait a moment and try again.")
	default:
		return apierr.Internal(err)
	}

	return writeJSON(w, http.StatusOK, map[string]any{
		"message":  challenge.Message,
		"nonce":    challenge.Nonce,
		"issuedAt": challenge.IssuedAt.UTC().Format(time.RFC3339),
	})
}

type signInVerifyBody struct {
	Address   string `json:"address"`
	Nonce     string `json:"nonce"`
	Signature string `json:"signature"`
	IssuedAt  string `json:"issuedAt"`
}

// handleSignInVerify checks the signature and, if it holds, starts a session.
//
// There is no separate sign-up. An address that has never been seen gets an
// account here, in the same step, because the signature that proves who they are
// is the same signature that would be needed to claim a pre-made account. Asking
// for anything else first would be ceremony around a fact already established.
func (s *Server) handleSignInVerify(w http.ResponseWriter, r *http.Request) error {
	var body signInVerifyBody
	if err := decode(r, &body); err != nil {
		return err
	}
	issuedAt, parseErr := time.Parse(time.RFC3339, body.IssuedAt)
	if parseErr != nil {
		return apierr.BadRequest("Missing or malformed issuedAt.")
	}

	user, err := s.auth.CompleteSignIn(r.Context(), body.Address, body.Nonce, body.Signature, issuedAt)
	switch {
	case err == nil:
	case errors.Is(err, auth.ErrBadSignature):
		return apierr.Unauthorized("That signature does not match the wallet.")
	case errors.Is(err, auth.ErrInvalidToken):
		return apierr.BadRequest("That sign-in request has expired. Try again.")
	case errors.Is(err, auth.ErrSuspended):
		return apierr.Forbidden("This account is suspended.")
	default:
		return apierr.Internal(err)
	}

	user = s.grantAdminIfListed(r.Context(), user)

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

// grantAdminIfListed gives the operator role to a wallet named in ADMIN_WALLETS.
//
// Admin access lives in the environment rather than in the database so that
// restoring a backup, or provisioning a new deployment, cannot silently drop the
// only person who can review anything. The grant is written to the audit log,
// because "who made themselves an admin, and when" is exactly the question an
// audit trail exists to answer.
func (s *Server) grantAdminIfListed(ctx context.Context, user auth.User) auth.User {
	if user.IsAdmin() || !s.cfg.IsAdminWallet(user.WalletAddress) {
		return user
	}
	if err := s.store.PromoteToAdmin(ctx, user.ID); err != nil {
		s.log.ErrorContext(ctx, "grant admin role", "user", user.ID, "error", err)
		return user
	}
	if err := s.store.RecordAudit(ctx, user.ID, "member.promote", "user", user.ID,
		map[string]any{"wallet": user.WalletAddress, "source": "ADMIN_WALLETS"}); err != nil {
		s.log.WarnContext(ctx, "audit admin promotion", "error", err)
	}
	user.Role = roleAdmin
	return user
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) error {
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
	out := map[string]any{"authenticated": true, "user": self}
	if self.Role == roleAdmin {
		out["adminAccess"] = adminAccess(r)
	}
	return writeJSON(w, http.StatusOK, out)
}

// handleLogoutAll ends every session the account has, on every device, and
// clears this browser's cookies.
func (s *Server) handleLogoutAll(w http.ResponseWriter, r *http.Request) error {
	u, err := requireUser(r)
	if err != nil {
		return err
	}
	if err := s.auth.RevokeAll(r.Context(), u.ID); err != nil {
		return apierr.Internal(err)
	}
	http.SetCookie(w, s.auth.ClearCookie())
	http.SetCookie(w, s.auth.CSRFCookie("", -time.Hour))
	return noContent(w)
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
