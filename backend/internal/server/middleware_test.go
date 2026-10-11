package server

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/config"
	"github.com/sardhana/backend/internal/ratelimit"
)

// authTestKey is 32 bytes of key material, the floor the auth service accepts.
const authTestKey = "0123456789abcdef0123456789abcdef"

// stubAuthStore satisfies auth.Store without implementing any of it. The CSRF
// check never reaches the store — it compares an HMAC against the key — so a
// test that somehow did would panic on the nil embedded interface rather than
// quietly pass.
type stubAuthStore struct{ auth.Store }

// stubMailer satisfies auth.Mailer for the same reason.
type stubMailer struct{}

func (stubMailer) Send(context.Context, auth.Message) error { return nil }

func testAuth(t *testing.T) *auth.Service {
	t.Helper()
	svc, err := auth.NewService(auth.Config{
		AppURL:     "https://sardhana.com",
		CookieName: "sardhana_session",
		Secure:     true,
		CSRFKey:    []byte(authTestKey),
	}, stubAuthStore{}, stubMailer{})
	if err != nil {
		t.Fatalf("build auth service: %v", err)
	}
	return svc
}

func testServer() *Server {
	cfg := config.Config{
		Env:                "production",
		AllowedOrigins:     []string{"https://sardhana.com"},
		RateLimitAnon:      60,
		RateLimitAuth:      5,
		RateLimitEngage:    60,
		RateLimitWrite:     60,
		RateLimitUpload:    10,
		RateLimitPoster:    60,
		RateLimitDonate:    10,
		RateLimitAdmin:     240,
		RateLimitIPCeiling: 600,
	}
	return &Server{
		cfg:     cfg,
		log:     slog.New(slog.NewTextHandler(io.Discard, nil)),
		limiter: ratelimit.New(cfg.RateLimitAnon),
		ceil:    ratelimit.New(cfg.RateLimitIPCeiling),
		budgets: buildBudgets(cfg),
		auth:    &auth.Service{},
	}
}

// testServerWithAuth is testServer plus a working auth service, for the tests
// that exercise the CSRF guard.
func testServerWithAuth(t *testing.T) *Server {
	t.Helper()
	s := testServer()
	s.auth = testAuth(t)
	return s
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

// The methods named in the preflight response are the set the browser will
// actually send. A verb the route table uses but this list omits is refused by
// the browser before the request leaves it, which looks like a broken feature
// rather than a missing header — so the two have to be kept in step.
func TestCORSAllowsEveryMethodTheRoutesUse(t *testing.T) {
	s := testServer()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/v1/me/bookmarks/thing", nil)
	req.Header.Set("Origin", "https://sardhana.com")
	s.cors(http.HandlerFunc(ok)).ServeHTTP(rec, req)

	allowed := rec.Header().Get("Access-Control-Allow-Methods")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight got %d, want 204", rec.Code)
	}
	// PUT is the one that was missing: saving a bookmark is a PUT, and so is a
	// local upload.
	for _, method := range []string{"GET", "POST", "PUT", "PATCH", "DELETE"} {
		if !strings.Contains(allowed, method) {
			t.Errorf("Access-Control-Allow-Methods %q does not allow %s", allowed, method)
		}
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

// --- cross-site request forgery -------------------------------------------

// A state-changing request with no Origin at all is refused. Everything the
// browser sends carries one, so a writer that cannot name an origin is not the
// web app.
func TestCSRFGuardRejectsUnsafeRequestWithoutOrigin(t *testing.T) {
	s := testServerWithAuth(t)
	handler := s.csrfGuard(http.HandlerFunc(ok))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/donations", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("originless POST got %d, want 403", rec.Code)
	}
}

func TestCSRFGuardRejectsForeignOrigin(t *testing.T) {
	s := testServerWithAuth(t)
	handler := s.csrfGuard(http.HandlerFunc(ok))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/donations", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("cross-site POST got %d, want 403", rec.Code)
	}
}

// Reading is not a state change, so the guard must let it through untouched —
// including for a signed-out visitor, who has no token to present.
func TestCSRFGuardAllowsSafeMethods(t *testing.T) {
	s := testServerWithAuth(t)
	handler := s.csrfGuard(http.HandlerFunc(ok))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/timelapses", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET got %d, want 200", rec.Code)
	}
}

// Requesting a sign-in link is a write from a caller who has no session, so the
// origin check alone has to carry it.
func TestCSRFGuardAllowsAnonymousWriteFromOurOrigin(t *testing.T) {
	s := testServerWithAuth(t)
	handler := s.csrfGuard(http.HandlerFunc(ok))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/request-link", nil)
	req.Header.Set("Origin", "https://sardhana.com")
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("anonymous sign-in request got %d, want 200", rec.Code)
	}
}

// With a session cookie present, the origin check is no longer enough: the
// double-submit token has to match this exact session or the request is refused.
func TestCSRFGuardRequiresATokenOnceASessionIsPresent(t *testing.T) {
	s := testServerWithAuth(t)
	handler := s.csrfGuard(http.HandlerFunc(ok))
	session := "a-session-cookie-value"

	post := func(token string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/v1/me/bookmarks/thing", nil)
		req.Header.Set("Origin", "https://sardhana.com")
		req.AddCookie(&http.Cookie{Name: "sardhana_session", Value: session})
		if token != "" {
			req.Header.Set(auth.CSRFHeader, token)
		}
		handler.ServeHTTP(rec, req)
		return rec
	}

	if rec := post(""); rec.Code != http.StatusForbidden {
		t.Errorf("session POST with no token got %d, want 403", rec.Code)
	}
	if rec := post("not-the-token"); rec.Code != http.StatusForbidden {
		t.Errorf("session POST with a forged token got %d, want 403", rec.Code)
	}
	if rec := post(s.auth.CSRFToken(session)); rec.Code != http.StatusOK {
		t.Errorf("session POST with the right token got %d, want 200", rec.Code)
	}
}

// --- response caching -----------------------------------------------------

func TestCacheHeadersMarkPrivateSurfacesNoStore(t *testing.T) {
	s := testServer()
	private := []string{"/v1/me/bookmarks", "/v1/admin/queue", "/v1/auth/session"}
	for _, path := range private {
		rec := httptest.NewRecorder()
		s.cacheHeaders(http.HandlerFunc(ok)).
			ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if got := rec.Header().Get("Cache-Control"); got != "no-store, must-revalidate" {
			t.Errorf("%s Cache-Control = %q, want no-store", path, got)
		}
	}

	// The public feed is readable by anyone, so it is not marked no-store; the
	// Vary header is what tells a cache that the body still depends on the
	// caller's cookie and origin.
	rec := httptest.NewRecorder()
	s.cacheHeaders(http.HandlerFunc(ok)).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/timelapses", nil))
	if got := rec.Header().Get("Cache-Control"); got != "" {
		t.Errorf("public feed Cache-Control = %q, want empty", got)
	}
	vary := strings.Join(rec.Header().Values("Vary"), ",")
	for _, want := range []string{"Origin", "Cookie"} {
		if !strings.Contains(vary, want) {
			t.Errorf("Vary = %q, missing %s", vary, want)
		}
	}
}

// A write's response describes one caller's action, so it is never cacheable
// even on a path that is otherwise public.
func TestCacheHeadersMarkWritesNoStore(t *testing.T) {
	s := testServer()
	rec := httptest.NewRecorder()
	s.cacheHeaders(http.HandlerFunc(ok)).
		ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/timelapses", nil))
	if got := rec.Header().Get("Cache-Control"); got != "no-store, must-revalidate" {
		t.Errorf("POST Cache-Control = %q, want no-store", got)
	}
}
