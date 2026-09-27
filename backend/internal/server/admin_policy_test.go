package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"

	"github.com/sardhana/auth"
)

func adminReq(age time.Duration, remote string) *http.Request {
	r := httptest.NewRequest("GET", "/v1/admin/queue", nil)
	r.RemoteAddr = remote
	ctx := context.WithValue(r.Context(), userKey, auth.User{ID: "u1", Role: roleAdmin, Status: "active"})
	ctx = context.WithValue(ctx, sessionKey, auth.Session{ID: "s1", CreatedAt: time.Now().Add(-age)})
	return r.WithContext(ctx)
}

func TestAdminPolicyAllowsAFreshSession(t *testing.T) {
	SetAdminPolicy(12*time.Hour, nil)
	defer SetAdminPolicy(0, nil)
	if _, err := requireAdmin(adminReq(time.Hour, "10.0.0.1:1")); err != nil {
		t.Fatalf("fresh admin session refused: %v", err)
	}
}

func TestAdminPolicyRefusesAStaleSession(t *testing.T) {
	SetAdminPolicy(12*time.Hour, nil)
	defer SetAdminPolicy(0, nil)
	r := adminReq(13*time.Hour, "10.0.0.1:1")
	if _, err := requireAdmin(r); err == nil {
		t.Fatal("a session older than the limit must be refused")
	}
	if got := adminAccess(r); got != adminStale {
		t.Fatalf("got %q, want %q", got, adminStale)
	}
}

func TestAdminPolicyRestrictsNetworks(t *testing.T) {
	SetAdminPolicy(0, []netip.Prefix{netip.MustParsePrefix("203.0.113.0/24")})
	defer SetAdminPolicy(0, nil)
	if _, err := requireAdmin(adminReq(time.Minute, "203.0.113.9:1")); err != nil {
		t.Fatalf("address inside the range refused: %v", err)
	}
	if _, err := requireAdmin(adminReq(time.Minute, "198.51.100.4:1")); err == nil {
		t.Fatal("address outside the range must be refused")
	}
}

func TestMembersAreNeverAdmins(t *testing.T) {
	SetAdminPolicy(0, nil)
	r := httptest.NewRequest("GET", "/v1/admin/queue", nil)
	ctx := context.WithValue(r.Context(), userKey, auth.User{ID: "u2", Role: roleMember, Status: "active"})
	if _, err := requireAdmin(r.WithContext(ctx)); err == nil {
		t.Fatal("a member must not pass requireAdmin")
	}
}
