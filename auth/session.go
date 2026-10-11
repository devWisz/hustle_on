package auth

import (
	"context"
	"fmt"
	"net/http"
	"net/netip"
	"time"
)

// Issue creates a session for a user and returns the cookie to set.
// The plaintext token is returned inside the cookie only; it is never logged,
// never returned in a response body and never stored.
func (s *Service) Issue(ctx context.Context, user User, ip netip.Addr, userAgent string) (*http.Cookie, error) {
	secret, digest, err := NewToken()
	if err != nil {
		return nil, err
	}
	now := s.now()
	sess := Session{
		UserID:     user.ID,
		TokenHash:  digest,
		IP:         ip,
		UserAgent:  truncate(userAgent, 500),
		ExpiresAt:  now.Add(s.cfg.SessionTTL),
		LastUsedAt: now,
		CreatedAt:  now,
	}
	if err := s.store.CreateSession(ctx, sess); err != nil {
		return nil, fmt.Errorf("auth: create session: %w", err)
	}
	return s.SessionCookie(secret, s.cfg.SessionTTL), nil
}

// Authenticate resolves the session cookie on a request.
// A session that is close to expiry is not silently extended here; refreshing
// is an explicit call so that read paths stay free of writes.
func (s *Service) Authenticate(ctx context.Context, r *http.Request) (Session, User, error) {
	c, err := r.Cookie(s.cfg.CookieName)
	if err != nil || c.Value == "" {
		return Session{}, User{}, ErrInvalidToken
	}
	sess, err := s.store.SessionByHash(ctx, Digest(c.Value))
	if err != nil {
		return Session{}, User{}, ErrInvalidToken
	}
	now := s.now()
	if !sess.Valid(now) {
		return Session{}, User{}, ErrInvalidToken
	}
	user, err := s.store.UserByID(ctx, sess.UserID)
	if err != nil || !user.Active() {
		return Session{}, User{}, ErrInvalidToken
	}
	return sess, user, nil
}

// Touch records session activity, at most once per interval so an active
// browser does not generate a write per request.
func (s *Service) Touch(ctx context.Context, sess Session, interval time.Duration) error {
	now := s.now()
	if now.Sub(sess.LastUsedAt) < interval {
		return nil
	}
	return s.store.TouchSession(ctx, sess.ID, now)
}

// Revoke ends the session behind a cookie value and returns the expiring cookie.
func (s *Service) Revoke(ctx context.Context, cookieValue string) (*http.Cookie, error) {
	if cookieValue != "" {
		if err := s.store.RevokeSession(ctx, Digest(cookieValue), s.now()); err != nil {
			return nil, fmt.Errorf("auth: revoke session: %w", err)
		}
	}
	return s.ClearCookie(), nil
}

// RevokeAll ends every session for a user. Called on "sign out everywhere",
// on role changes and whenever an account is suspended.
func (s *Service) RevokeAll(ctx context.Context, userID string) error {
	if err := s.store.RevokeUserSessions(ctx, userID, s.now()); err != nil {
		return fmt.Errorf("auth: revoke sessions: %w", err)
	}
	return nil
}

// RevokeOthers ends every session for a user except the one behind this cookie.
//
// A cookie value that names no session — the caller was not authenticated by one,
// or it has already gone — falls back to ending all of them, because the safe
// reading of "keep this one" when there is no this one is not to keep a stranger's.
func (s *Service) RevokeOthers(ctx context.Context, userID, cookieValue string) error {
	if cookieValue == "" {
		return s.RevokeAll(ctx, userID)
	}
	if err := s.store.RevokeOtherSessions(ctx, userID, Digest(cookieValue), s.now()); err != nil {
		return fmt.Errorf("auth: revoke other sessions: %w", err)
	}
	return nil
}
