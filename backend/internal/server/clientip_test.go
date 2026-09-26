package server

import (
	"net/http/httptest"
	"testing"
)

func TestClientIPIgnoresForwardingByDefault(t *testing.T) {
	SetTrustedProxyHops(0)
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.5:4000"
	r.Header.Set("X-Forwarded-For", "1.2.3.4")
	if got := clientIP(r).String(); got != "10.0.0.5" {
		t.Fatalf("got %s, want the TCP peer", got)
	}
}

func TestClientIPUsesTheEntryWrittenByTheTrustedProxy(t *testing.T) {
	SetTrustedProxyHops(1)
	defer SetTrustedProxyHops(0)
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.5:4000"
	r.Header.Set("X-Forwarded-For", "6.6.6.6, 203.0.113.9")
	if got := clientIP(r).String(); got != "203.0.113.9" {
		t.Fatalf("got %s, want the rightmost entry, not the forged leftmost one", got)
	}
}

func TestClientIPWithTwoProxies(t *testing.T) {
	SetTrustedProxyHops(2)
	defer SetTrustedProxyHops(0)
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.5:4000"
	r.Header.Add("X-Forwarded-For", "6.6.6.6, 198.51.100.7")
	r.Header.Add("X-Forwarded-For", "10.1.1.1")
	if got := clientIP(r).String(); got != "198.51.100.7" {
		t.Fatalf("got %s", got)
	}
}

func TestClientIPFallsBackWhenHeaderIsShortOrInvalid(t *testing.T) {
	SetTrustedProxyHops(2)
	defer SetTrustedProxyHops(0)
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.5:4000"
	r.Header.Set("X-Forwarded-For", "not-an-ip")
	if got := clientIP(r).String(); got != "10.0.0.5" {
		t.Fatalf("got %s, want the TCP peer", got)
	}
}

func TestInternalClientIPNeedsTheSecret(t *testing.T) {
	SetInternalProxySecret("0123456789abcdef0123456789abcdef")
	defer SetInternalProxySecret("")

	forged := httptest.NewRequest("GET", "/", nil)
	forged.RemoteAddr = "10.0.0.5:4000"
	forged.Header.Set("X-Sardhana-Client-IP", "9.9.9.9")
	forged.Header.Set("X-Sardhana-Proxy-Key", "wrong")
	if got := clientIP(forged).String(); got != "10.0.0.5" {
		t.Fatalf("a wrong key must be ignored, got %s", got)
	}

	trusted := httptest.NewRequest("GET", "/", nil)
	trusted.RemoteAddr = "10.0.0.5:4000"
	trusted.Header.Set("X-Sardhana-Client-IP", "203.0.113.20")
	trusted.Header.Set("X-Sardhana-Proxy-Key", "0123456789abcdef0123456789abcdef")
	if got := clientIP(trusted).String(); got != "203.0.113.20" {
		t.Fatalf("got %s, want the forwarded visitor address", got)
	}
}

func TestInternalClientIPDisabledWithoutSecret(t *testing.T) {
	SetInternalProxySecret("")
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.5:4000"
	r.Header.Set("X-Sardhana-Client-IP", "9.9.9.9")
	r.Header.Set("X-Sardhana-Proxy-Key", "")
	if got := clientIP(r).String(); got != "10.0.0.5" {
		t.Fatalf("got %s", got)
	}
}
