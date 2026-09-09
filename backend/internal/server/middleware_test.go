package server

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

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
		authLim: ratelimit.New(5),
	}
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
