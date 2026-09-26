package server

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/logging"
	"github.com/sardhana/backend/pkg/apierr"
)

type ctxKey int

const (
	userKey ctxKey = iota
	sessionKey
)

// The two roles the platform has. A member publishes and receives donations;
// an admin additionally decides what reaches the feed.
const (
	roleMember = "member"
	roleAdmin  = "admin"
)

// requestID assigns an id to every request and echoes it back, so a user
// reporting a failure can be matched to the exact log line.
func (s *Server) requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, 8)
		_, _ = rand.Read(buf)
		id := hex.EncodeToString(buf)
		w.Header().Set("X-Request-Id", id)
		next.ServeHTTP(w, r.WithContext(logging.WithRequestID(r.Context(), id)))
	})
}

// statusRecorder captures the status code for logging.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *statusRecorder) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusRecorder) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytes += n
	return n, err
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		// Query strings can carry tokens (the magic-link callback does), so the
		// path is logged without them.
		s.log.InfoContext(r.Context(), "request",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", rec.status),
			slog.Int("bytes", rec.bytes),
			slog.Duration("took", time.Since(start)),
			slog.String("request_id", logging.RequestID(r.Context())))
	})
}

// recoverPanic keeps one bad request from taking the process down, and makes
// sure the client gets a proper 500 rather than a dropped connection.
func (s *Server) recoverPanic(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				s.log.ErrorContext(r.Context(), "panic recovered",
					slog.Any("panic", rec),
					slog.String("path", r.URL.Path),
					slog.String("request_id", logging.RequestID(r.Context())))
				s.writeError(w, r, apierr.Internal(errors.New("panic recovered")))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// securityHeaders sets the response headers that constrain what a browser will
// do with our output. The API returns JSON only, so the policy can be as tight
// as it gets: nothing is allowed to load, frame or execute.
func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
		h.Set("Cross-Origin-Resource-Policy", "same-site")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
		if s.cfg.IsProduction() {
			h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		}
		next.ServeHTTP(w, r)
	})
}

// cors answers only for origins on the configured allowlist. Credentials are
// permitted, which is exactly why the origin can never be reflected blindly.
func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := strings.TrimRight(r.Header.Get("Origin"), "/")
		allowed := origin != "" && s.originAllowed(origin)

		if allowed {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type, "+auth.CSRFHeader)
			h.Set("Access-Control-Max-Age", "600")
			// Vary: Origin is set once, by cacheHeaders, which runs outside this
			// middleware and therefore covers the preflight path too.
		}
		if r.Method == http.MethodOptions {
			status := http.StatusNoContent
			if !allowed {
				status = http.StatusForbidden
			}
			w.WriteHeader(status)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) originAllowed(origin string) bool {
	for _, o := range s.cfg.AllowedOrigins {
		if strings.EqualFold(o, origin) {
			return true
		}
	}
	return false
}

// ipCeiling bounds how much work one address can cause before its session has
// been resolved.
//
// It is deliberately far looser than the real budget: a household, an office or
// a mobile carrier's NAT can legitimately present thousands of distinct callers
// from one address, and throttling all of them as a single client is the bug
// this whole arrangement exists to avoid. What it does stop is one address
// spraying requests, each with a different cookie, to make the process perform a
// session lookup for every one.
func (s *Server) ipCeiling(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		key := "ip:" + clientIP(r).String()
		if !s.ceil.Allow(key) {
			retry := s.ceil.RetryAfter(key)
			w.Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())+1))
			s.writeError(w, r, apierr.TooManyRequests(""))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// rateLimit applies a per-client budget.
//
// An authenticated caller is keyed by user id, so one office behind a single NAT
// address is not throttled as one client, while anonymous traffic is keyed by
// address — there is nothing else to key it on. This is why the middleware runs
// after attachSession; before it, the user simply is not known yet.
func (s *Server) rateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}
		key := "ip:" + clientIP(r).String()
		if u, ok := currentUser(r); ok {
			key = "user:" + u.ID
		}
		if !s.limiter.Allow(key) {
			retry := s.limiter.RetryAfter(key)
			w.Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())+1))
			s.writeError(w, r, apierr.TooManyRequests(""))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// csrfGuard is the single point at which cross-site request forgery is refused.
//
// Every state-changing method on every route passes through here, so protection
// is a property of the API rather than of remembering to call a helper in each
// handler. The check itself lives in the auth package — origin allowlist first,
// then the double-submit token bound to this session — and this middleware only
// decides that it runs and what a refusal looks like.
func (s *Server) csrfGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := s.auth.CheckCSRF(r, s.cfg.AllowedOrigins); err != nil {
			s.writeError(w, r, apierr.Forbidden(
				"This request could not be verified. Reload the page and try again."))
			return
		}
		next.ServeHTTP(w, r)
	})
}

// privatePrefixes are the API surfaces whose response depends on who is asking.
// Everything under them is per-caller data and must never be reused for anyone
// else, least of all by an intermediary that only looked at the URL.
var privatePrefixes = []string{"/v1/me", "/v1/admin", "/v1/auth"}

// cacheHeaders stops anything between us and the caller from reusing a response
// it should not.
//
// Two things vary the response here that a URL does not: the Origin (the CORS
// headers differ per origin) and the session cookie (the payload differs per
// caller). Saying so in Vary is what makes the distinction visible to a cache;
// without it, a shared cache can hand one signed-in user another's saved list.
func (s *Server) cacheHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Add("Vary", "Origin")
		h.Add("Vary", "Cookie")
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			// A write's response describes one caller's action.
			h.Set("Cache-Control", "no-store, must-revalidate")
		} else if isPrivatePath(r.URL.Path) {
			h.Set("Cache-Control", "no-store, must-revalidate")
		}
		next.ServeHTTP(w, r)
	})
}

func isPrivatePath(path string) bool {
	for _, p := range privatePrefixes {
		if path == p || strings.HasPrefix(path, p+"/") {
			return true
		}
	}
	return false
}

// attachSession resolves the session cookie, if any, and stores the user on
// the request context. It never rejects: routes decide what they require.
func (s *Server) attachSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sess, user, err := s.auth.Authenticate(r.Context(), r)
		if err == nil {
			ctx := context.WithValue(r.Context(), userKey, user)
			ctx = context.WithValue(ctx, sessionKey, sess)
			r = r.WithContext(ctx)
			// Activity is recorded at most hourly to keep reads read-only.
			if err := s.auth.Touch(r.Context(), sess, time.Hour); err != nil {
				s.log.WarnContext(r.Context(), "touch session", slog.Any("error", err))
			}
			// A session can outlive its CSRF cookie — a browser may drop it, an
			// old tab may hold a stale copy — and every write would then fail
			// with an opaque 403 until the user signed out and back in. Reissue
			// it here instead. The refusal above still stands for the request
			// that lacked the token; this only makes the next one work.
			s.refreshCSRFCookie(w, r)
		}
		next.ServeHTTP(w, r)
	})
}

// refreshCSRFCookie reissues the CSRF cookie when a signed-in caller presents a
// session without one. The token is derived from the session value, so it is not
// a new secret: it is the same value the caller would have had.
func (s *Server) refreshCSRFCookie(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(s.auth.CSRFCookieName())
	if err == nil && c.Value != "" {
		return
	}
	session, err := r.Cookie(s.cfg.SessionCookieName)
	if err != nil || session.Value == "" {
		return
	}
	http.SetCookie(w, s.auth.CSRFCookie(
		s.auth.CSRFToken(session.Value), s.cfg.SessionTTL))
}

// currentUser returns the signed-in user, if there is one.
func currentUser(r *http.Request) (auth.User, bool) {
	u, ok := r.Context().Value(userKey).(auth.User)
	return u, ok
}

// requireUser returns the signed-in user or an unauthorised error.
func requireUser(r *http.Request) (auth.User, error) {
	u, ok := currentUser(r)
	if !ok {
		return auth.User{}, apierr.Unauthorized("")
	}
	return u, nil
}

// requireAdmin enforces the review boundary. Every endpoint that can change
// what the public sees goes through here.
func requireAdmin(r *http.Request) (auth.User, error) {
	u, err := requireUser(r)
	if err != nil {
		return auth.User{}, err
	}
	if u.Role != roleAdmin {
		return auth.User{}, apierr.Forbidden("")
	}
	return u, nil
}

// randomSuffix returns a short token used to widen a slug that is already
// taken. It is not a secret, only a tiebreaker.
func randomSuffix() string {
	buf := make([]byte, 3)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

// clientIP extracts the caller's address.
//
// X-Forwarded-For is only honoured when the platform is running behind a proxy
// that sets it; taking it from an arbitrary client would let anyone spoof their
// address and sidestep every per-address limit.
// clientIP returns the address a request came from.
//
// With trustedProxyHops = 0 (the default) it is the TCP peer, and forwarding
// headers are ignored. Behind N proxies you control, each one appends the
// address it saw to X-Forwarded-For, so the Nth entry from the right is the
// last one written by a trusted proxy. Anything to the left of it was supplied
// by the client and can be forged, which is why the leftmost entry is never
// used.
func clientIP(r *http.Request) netip.Addr {
	if addr, ok := internalClientIP(r); ok {
		return addr
	}
	if trustedProxyHops > 0 {
		if addr, ok := forwardedFor(r.Header.Values("X-Forwarded-For"), trustedProxyHops); ok {
			return addr
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}
	}
	return addr
}

func forwardedFor(headers []string, hops int) (netip.Addr, bool) {
	var entries []string
	for _, h := range headers {
		for _, part := range strings.Split(h, ",") {
			if part = strings.TrimSpace(part); part != "" {
				entries = append(entries, part)
			}
		}
	}
	i := len(entries) - hops
	if i < 0 || i >= len(entries) {
		return netip.Addr{}, false
	}
	addr, err := netip.ParseAddr(entries[i])
	if err != nil {
		return netip.Addr{}, false
	}
	return addr.Unmap(), true
}

// internalClientIP reads the visitor address that the web app's own server
// forwards when it calls the API while rendering a page. It is honoured only
// with the shared INTERNAL_PROXY_SECRET, compared in constant time; browsers
// cannot send either header because CORS does not allow them.
func internalClientIP(r *http.Request) (netip.Addr, bool) {
	if len(internalProxySecret) == 0 {
		return netip.Addr{}, false
	}
	key := r.Header.Get(internalKeyHeader)
	if key == "" || subtle.ConstantTimeCompare([]byte(key), internalProxySecret) != 1 {
		return netip.Addr{}, false
	}
	addr, err := netip.ParseAddr(strings.TrimSpace(r.Header.Get(internalIPHeader)))
	if err != nil {
		return netip.Addr{}, false
	}
	return addr.Unmap(), true
}

const (
	internalKeyHeader = "X-Sardhana-Proxy-Key"
	internalIPHeader  = "X-Sardhana-Client-IP"
)

var internalProxySecret []byte

// SetInternalProxySecret enables forwarded visitor addresses from the web
// app's server. An empty secret disables the feature.
func SetInternalProxySecret(secret string) { internalProxySecret = []byte(secret) }

// trustedProxyHops is set at startup from TRUSTED_PROXY_HOPS (or the older
// TRUST_PROXY_HEADERS=true, which means one hop). It must match the number of
// proxies in front of the API that append to X-Forwarded-For.
var trustedProxyHops = 0

func SetTrustedProxyHops(n int) {
	if n < 0 {
		n = 0
	}
	trustedProxyHops = n
}

func userAgent(r *http.Request) string {
	ua := r.Header.Get("User-Agent")
	if len(ua) > 500 {
		return ua[:500]
	}
	return ua
}
