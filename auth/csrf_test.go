package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func testService(t *testing.T) *Service {
	t.Helper()
	svc, err := NewService(Config{
		AppURL:  "https://hustleon.com",
		CSRFKey: []byte("0123456789abcdef0123456789abcdef"),
	}, newStubStore(), stubHasher{})
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}
	return svc
}

var origins = []string{"https://hustleon.com"}

func TestCheckCSRFAllowsSafeMethods(t *testing.T) {
	svc := testService(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/feed", nil)
	if err := svc.CheckCSRF(req, origins); err != nil {
		t.Fatalf("a GET was rejected: %v", err)
	}
}

func TestCheckCSRFRejectsForeignOrigins(t *testing.T) {
	svc := testService(t)
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/wallet/challenge", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	if err := svc.CheckCSRF(req, origins); err == nil {
		t.Fatal("a cross-origin POST was accepted")
	}

	// A missing Origin is treated the same way: it is not one of ours.
	req = httptest.NewRequest(http.MethodPost, "/v1/auth/wallet/challenge", nil)
	if err := svc.CheckCSRF(req, origins); err == nil {
		t.Fatal("a POST with no Origin was accepted")
	}
}

func TestCheckCSRFOnAnonymousRequests(t *testing.T) {
	svc := testService(t)
	// Signing in has no session yet, so the origin check stands alone.
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/wallet/challenge", nil)
	req.Header.Set("Origin", "https://hustleon.com")
	if err := svc.CheckCSRF(req, origins); err != nil {
		t.Fatalf("an anonymous same-origin POST was rejected: %v", err)
	}
}

func TestCheckCSRFRequiresATokenOnceSignedIn(t *testing.T) {
	svc := testService(t)
	const sessionValue = "session-token-value"

	req := httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	req.Header.Set("Origin", "https://hustleon.com")
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

// The loopback spellings are one address, and treating them as anything else is
// what produced "This request could not be verified. Reload the page and try
// again" for a site that was working perfectly on the other spelling.
func TestOriginAllowedTreatsLoopbackSpellingsAsOne(t *testing.T) {
	allowed := []string{"http://localhost:3001"}

	for _, origin := range []string{
		"http://localhost:3001",
		"http://localhost:3001/", // a trailing slash is not a different origin
		"http://127.0.0.1:3001",
		"http://[::1]:3001",
	} {
		if !OriginAllowed(origin, allowed) {
			t.Errorf("%q was refused, and it is the same server", origin)
		}
	}
}

// The exception is confined to loopback, and only within it does anything get
// matched loosely. Everything here must still be refused.
func TestOriginAllowedIsStrictEverywhereElse(t *testing.T) {
	allowed := []string{"http://localhost:3001"}

	for _, tc := range []struct{ origin, why string }{
		{"", "an empty origin"},
		{"http://localhost:3002", "a different port is a different service"},
		{"https://localhost:3001", "a different scheme is a different origin"},
		{"http://127.0.0.1:3002", "a different port on the other spelling"},
		{"http://evil.example.com", "an unrelated host"},
		{"http://localhost.evil.com:3001", "a host that merely starts with localhost"},
		{"http://127.0.0.1.evil.com:3001", "a host that merely starts with a loopback address"},
		{"null", "the literal null origin a sandboxed frame sends"},
	} {
		if OriginAllowed(tc.origin, allowed) {
			t.Errorf("%s (%q) was accepted", tc.why, tc.origin)
		}
	}

	// And a public origin is only ever matched exactly.
	if !OriginAllowed("https://hustleon.com", []string{"https://hustleon.com"}) {
		t.Error("an exact production origin was refused")
	}
	if OriginAllowed("http://hustleon.com", []string{"https://hustleon.com"}) {
		t.Error("the http form of a production origin was accepted")
	}
	if OriginAllowed("https://api.hustleon.com", []string{"https://hustleon.com"}) {
		t.Error("a subdomain was accepted as its parent")
	}
}
