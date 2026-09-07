package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func testService(t *testing.T) *Service {
	t.Helper()
	svc, err := NewService(Config{
		AppURL:  "https://sardhana.com",
		CSRFKey: []byte("0123456789abcdef0123456789abcdef"),
	}, stubStore{}, LogMailer{Out: discard{}})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return svc
}

var origins = []string{"https://sardhana.com"}

func TestCheckCSRFAllowsSafeMethods(t *testing.T) {
	svc := testService(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/feed", nil)
	if err := svc.CheckCSRF(req, origins); err != nil {
		t.Fatalf("a GET was rejected: %v", err)
	}
}

func TestCheckCSRFRejectsForeignOrigins(t *testing.T) {
	svc := testService(t)
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/request-link", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	if err := svc.CheckCSRF(req, origins); err == nil {
		t.Fatal("a cross-origin POST was accepted")
	}

	// A missing Origin is treated the same way: it is not one of ours.
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/request-link", nil)
	if err := svc.CheckCSRF(req, origins); err == nil {
		t.Fatal("a POST with no Origin was accepted")
	}
}

func TestCheckCSRFOnAnonymousRequests(t *testing.T) {
	svc := testService(t)
	// Signing in has no session yet, so the origin check stands alone.
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/request-link", nil)
	req.Header.Set("Origin", "https://sardhana.com")
	if err := svc.CheckCSRF(req, origins); err != nil {
		t.Fatalf("an anonymous same-origin POST was rejected: %v", err)
	}
}

func TestCheckCSRFRequiresATokenOnceSignedIn(t *testing.T) {
	svc := testService(t)
	const sessionValue = "session-token-value"

	req := httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	req.Header.Set("Origin", "https://sardhana.com")
	req.AddCookie(&http.Cookie{Name: svc.cfg.CookieName, Value: sessionValue})
	if err := svc.CheckCSRF(req, origins); err == nil {
		t.Fatal("a session request with no CSRF header was accepted")
	}

	req.Header.Set(CSRFHeader, "wrong-token")
	if err := svc.CheckCSRF(req, origins); err == nil {
		t.Fatal("a session request with a forged CSRF token was accepted")
	}

	req.Header.Set(CSRFHeader, svc.CSRFToken(sessionValue))
	if err := svc.CheckCSRF(req, origins); err != nil {
		t.Fatalf("a correctly signed request was rejected: %v", err)
	}

	// The token is bound to this session, so one lifted from another session
	// does not work here.
	req.Header.Set(CSRFHeader, svc.CSRFToken("a-different-session"))
	if err := svc.CheckCSRF(req, origins); err == nil {
		t.Fatal("a CSRF token from another session was accepted")
	}
}
