package auth

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"net/netip"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// LoginRequest is a request for an email login link.
type LoginRequest struct {
	Email     string
	IP        netip.Addr
	UserAgent string
	// Next is an optional in-app path to return to after login. Only paths are
	// accepted; an absolute URL here would make this an open redirect.
	Next string
}

// StartLogin issues a single-use login link and emails it.
//
// The response is deliberately identical whether or not the address belongs to
// an existing account. Callers must not vary their reply based on the returned
// error other than for ErrRateLimited and genuine internal failures.
func (s *Service) StartLogin(ctx context.Context, req LoginRequest) error {
	email, err := NormalizeEmail(req.Email)
	if err != nil {
		return err
	}
	now := s.now()

	n, err := s.store.CountRecentMagicLinks(ctx, email, now.Add(-time.Hour))
	if err != nil {
		return fmt.Errorf("auth: count recent links: %w", err)
	}
	if n >= s.cfg.MaxLinksPerHour {
		return ErrRateLimited
	}

	secret, digest, err := NewToken()
	if err != nil {
		return err
	}

	// A user row may not exist yet; the account is created when the link is
	// consumed, so that an unverified address never occupies a handle.
	var userID string
	if u, err := s.store.UserByEmail(ctx, email); err == nil {
		if !u.Active() {
			// Suspended accounts get no link, but the caller still reports success.
			return nil
		}
		userID = u.ID
	} else if !errors.Is(err, ErrNotFound) {
		return fmt.Errorf("auth: look up user: %w", err)
	}

	link := MagicLink{
		UserID:    userID,
		Email:     email,
		TokenHash: digest,
		Purpose:   "login",
		ExpiresAt: now.Add(s.cfg.MagicLinkTTL),
		IP:        req.IP,
		UserAgent: truncate(req.UserAgent, 500),
		CreatedAt: now,
	}
	if err := s.store.CreateMagicLink(ctx, link); err != nil {
		return fmt.Errorf("auth: store link: %w", err)
	}

	return s.sendLoginEmail(ctx, email, s.buildLoginURL(secret, req.Next))
}

// buildLoginURL assembles the verification URL. The `next` parameter is
// restricted to a same-site path, so a crafted link cannot bounce a freshly
// authenticated visitor to an attacker's origin.
func (s *Service) buildLoginURL(secret, next string) string {
	u, err := url.Parse(strings.TrimRight(s.cfg.AppURL, "/") + "/auth/verify")
	if err != nil {
		return ""
	}
	q := u.Query()
	q.Set("token", secret)
	if p := SafeRedirectPath(next); p != "" {
		q.Set("next", p)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// CompleteLogin consumes a login token and returns the authenticated user.
// The account is created on first successful verification.
func (s *Service) CompleteLogin(ctx context.Context, secret string) (User, error) {
	if secret == "" {
		return User{}, ErrInvalidToken
	}
	now := s.now()

	link, err := s.store.ConsumeMagicLink(ctx, Digest(secret), now)
	if err != nil {
		// Every storage-level miss is reported as a plain invalid token.
		return User{}, ErrInvalidToken
	}
	if now.After(link.ExpiresAt) {
		return User{}, ErrInvalidToken
	}

	user, err := s.store.UserByEmail(ctx, link.Email)
	switch {
	case err == nil:
		if !user.Active() {
			return User{}, ErrInvalidToken
		}
	case errors.Is(err, ErrNotFound):
		user, err = s.createAccount(ctx, link.Email)
		if err != nil {
			return User{}, err
		}
	default:
		return User{}, fmt.Errorf("auth: look up user: %w", err)
	}

	if !user.EmailVerified {
		if err := s.store.MarkEmailVerified(ctx, user.ID, now); err != nil {
			return User{}, fmt.Errorf("auth: mark verified: %w", err)
		}
		user.EmailVerified = true
	}
	return user, nil
}

// createAccount registers a new user, deriving a handle from the address and
// widening it until the store accepts it as unique.
func (s *Service) createAccount(ctx context.Context, email string) (User, error) {
	base := SuggestHandle(email)
	for attempt := 0; attempt < 5; attempt++ {
		handle := base
		if attempt > 0 {
			suffix, err := NewNonce()
			if err != nil {
				return User{}, err
			}
			handle = truncate(base, 24) + strings.ToLower(suffix[:4])
			handle = handleUnsafe.ReplaceAllString(handle, "")
		}
		user, err := s.store.CreateUser(ctx, email, handle, handle)
		if err == nil {
			return user, nil
		}
		if !errors.Is(err, ErrHandleTaken) {
			return User{}, fmt.Errorf("auth: create user: %w", err)
		}
	}
	return User{}, errors.New("auth: could not allocate a unique handle")
}

// ErrHandleTaken is returned by Store.CreateUser on a handle collision so the
// service can retry with a different one.
var ErrHandleTaken = errors.New("auth: handle already taken")

var handleUnsafe = regexp.MustCompile(`[^a-z0-9_]`)

// NormalizeEmail validates and canonicalises an address for storage.
func NormalizeEmail(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if len(trimmed) == 0 || len(trimmed) > 254 {
		return "", errors.New("auth: email is required")
	}
	addr, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", errors.New("auth: email is not valid")
	}
	at := strings.LastIndex(addr.Address, "@")
	if at < 1 {
		return "", errors.New("auth: email is not valid")
	}
	// Only the domain is lowercased; the local part is case-sensitive per RFC
	// 5321. The database column is citext, which handles comparison.
	return addr.Address[:at] + "@" + strings.ToLower(addr.Address[at+1:]), nil
}

// SuggestHandle derives a usable default handle from an email address.
func SuggestHandle(email string) string {
	local, _, _ := strings.Cut(email, "@")
	h := handleUnsafe.ReplaceAllString(strings.ToLower(local), "")
	if len(h) < 3 {
		h = "builder" + h
	}
	return truncate(h, 30)
}

// SafeRedirectPath returns next when it is a relative in-app path, else "".
// Rejecting anything else is what stops the login link from being turned into
// an open redirect.
func SafeRedirectPath(next string) string {
	if next == "" || !strings.HasPrefix(next, "/") {
		return ""
	}
	// "//host" and "/\host" are protocol-relative URLs, not local paths.
	if strings.HasPrefix(next, "//") || strings.HasPrefix(next, "/\\") {
		return ""
	}
	if strings.ContainsAny(next, "\r\n") || len(next) > 512 {
		return ""
	}
	return next
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
