package server

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/config"
	"github.com/sardhana/backend/internal/ratelimit"
)

func testServer() *Server {
	return &Server{
		cfg: config.Config{
			Env:            "production",
			AllowedOrigins: []string{"https://sardhana.com"},
			RateLimitAnon:  60,
		},
		log:     slog.New(slog.NewTextHandler(io.Discard, nil)),
		limiter: ratelimit.New(60),
		ceil:    ratelimit.New(600),
		authLim: ratelimit.New(5),
	}
}

/** asUser returns a request carrying a resolved session, the way attachSession
 * leaves one for the limiter to key on. */
func asUser(r *http.Request, id string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), userKey, auth.User{
		ID: id, Role: roleMember, Status: "active",
	}))
}

func ok(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }

func TestSecurityHeadersAreSet(t *testing.T) {
	rec := httptest.NewRecorder()
	testServer().securityHeaders(http.HandlerFunc(ok)).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/feed", nil))

	want := map[string]string{
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "DENY",
		"Referrer-Policy":           "no-referrer",
		"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
	}
	for header, value := range want {
		if got := rec.Header().Get(header); got != value {
			t.Errorf("%s = %q, want %q", header, got, value)
		}
	}
}

func TestCORSOnlyAnswersAllowedOrigins(t *testing.T) {
	s := testServer()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/feed", nil)
	req.Header.Set("Origin", "https://sardhana.com")
	s.cors(http.HandlerFunc(ok)).ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://sardhana.com" {
		t.Errorf("allowed origin was not echoed, got %q", got)
	}

	// An unlisted origin must never be reflected: the API sends credentials.
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/v1/feed", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	s.cors(http.HandlerFunc(ok)).ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("unlisted origin was reflected as %q", got)
	}
}

func TestRateLimitRejectsAFlood(t *testing.T) {
	s := testServer()
	s.limiter = ratelimit.New(4) // burst of 1
	handler := s.rateLimit(http.HandlerFunc(ok))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/feed", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("first request got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/feed", nil))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second request got %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Error("no Retry-After on a throttled response")
	}
}

// Two people behind one address each get their own budget. This is the whole
// reason the limiter runs after attachSession rather than before it.
func TestRateLimitKeysAuthenticatedCallersByUser(t *testing.T) {
	s := testServer()
	s.limiter = ratelimit.New(4) // burst of 1
	handler := s.rateLimit(http.HandlerFunc(ok))

	// Same office, same RemoteAddr, two different accounts.
	for _, id := range []string{"user-a", "user-b"} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, asUser(httptest.NewRequest(http.MethodGet, "/v1/me", nil), id))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s got %d, want 200 — one account's traffic throttled another's", id, rec.Code)
		}
	}

	// A second request from the already-spent account is still refused.
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, asUser(httptest.NewRequest(http.MethodGet, "/v1/me", nil), "user-a"))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("repeat request got %d, want 429", rec.Code)
	}
}

// Anonymous callers have no identity to key on, so they share the address
// budget — and one anonymous caller must not be able to exhaust it for a
// signed-in neighbour, because the two keys are distinct.
func TestRateLimitSeparatesAnonymousFromSignedIn(t *testing.T) {
	s := testServer()
	s.limiter = ratelimit.New(4) // burst of 1
	handler := s.rateLimit(http.HandlerFunc(ok))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/feed", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("anonymous request got %d", rec.Code)
	}

	// The address budget is spent; a signed-in caller from the same address is
	// keyed separately and still allowed through.
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, asUser(httptest.NewRequest(http.MethodGet, "/v1/me", nil), "user-a"))
	if rec.Code != http.StatusOK {
		t.Fatalf("signed-in request got %d, want 200 — anonymous traffic consumed the user's budget", rec.Code)
	}
}

// The ceiling bounds work done before the session is known, so it must apply
// even when every request carries a different cookie.
func TestIPCeilingAppliesBeforeSessionResolution(t *testing.T) {
	s := testServer()
	s.ceil = ratelimit.New(4) // burst of 1
	handler := s.ipCeiling(http.HandlerFunc(ok))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/feed", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("first request got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, asUser(httptest.NewRequest(http.MethodGet, "/v1/feed", nil), "user-b"))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second request got %d, want 429 — the ceiling does not distinguish users", rec.Code)
	}
}
