package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/media"
	"github.com/sardhana/backend/internal/store"
)

// These tests cover the guards that run *before* the store is touched: which
// keys may become a thumbnail, what an edit body has to contain, and what the
// shelf reorder will accept. The queries themselves are exercised against a real
// database; what is tested here is the refusals, because those are the paths a
// caller can reach with a crafted request.

const testAdminID = "00000000-0000-0000-0000-0000000000aa"

// operatorServer is a server with a local media store and no database. A handler
// that reaches the store panics on the nil pool, which is a useful failure: it
// says the request should have been refused before that point.
func operatorServer() *Server {
	s := testServer()
	s.media = media.New(media.Config{
		Endpoint: "http://localhost:8085",
		Bucket:   "sardhana-media",
		MaxBytes: 1 << 20,
	})
	return s
}

// operatorRequest builds a request carrying a resolved admin session, the way
// attachSession leaves one.
func operatorRequest(method, target, body string) *http.Request {
	r := httptest.NewRequest(method, target, strings.NewReader(body))
	ctx := context.WithValue(r.Context(), userKey, auth.User{
		ID: testAdminID, Role: roleAdmin, Status: "active",
	})
	return r.WithContext(ctx)
}

func runHandler(t *testing.T, h handler, r *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	if err := h(rec, r); err != nil {
		// The handlers under test return their errors; render them the way wrap
		// would, so the assertion is on the status the client would see.
		operatorServer().writeError(rec, r, err)
	}
	return rec
}

// A session's own video must never become its poster: the two are different
// objects with different rules, and a poster is served as an image.
func TestThumbnailRefusesAVideoKey(t *testing.T) {
	s := operatorServer()
	r := operatorRequest(http.MethodPut, "/v1/admin/timelapses/x/thumbnail",
		`{"key":"uploads/`+testAdminID+`/2026/09/clip.mp4"}`)
	r.SetPathValue("id", "11111111-1111-1111-1111-111111111111")

	if rec := runHandler(t, s.handleAdminSetThumbnail, r); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("a video key as a thumbnail got %d, want 422", rec.Code)
	}
}

// Knowing a poster's object name is not permission to attach it. Without this,
// one operator could publish an image uploaded under another's account.
func TestThumbnailRefusesSomebodyElsesPoster(t *testing.T) {
	s := operatorServer()
	r := operatorRequest(http.MethodPut, "/v1/admin/timelapses/x/thumbnail",
		`{"key":"posters/00000000-0000-0000-0000-0000000000bb/2026/09/poster.jpg"}`)
	r.SetPathValue("id", "11111111-1111-1111-1111-111111111111")

	if rec := runHandler(t, s.handleAdminSetThumbnail, r); rec.Code != http.StatusForbidden {
		t.Fatalf("another account's poster got %d, want 403", rec.Code)
	}
}

func TestThumbnailRequiresAValidTarget(t *testing.T) {
	s := operatorServer()
	r := operatorRequest(http.MethodPut, "/v1/admin/timelapses/not-a-uuid/thumbnail",
		`{"key":"posters/`+testAdminID+`/2026/09/poster.jpg"}`)
	r.SetPathValue("id", "not-a-uuid")

	if rec := runHandler(t, s.handleAdminSetThumbnail, r); rec.Code != http.StatusNotFound {
		t.Fatalf("a malformed id got %d, want 404", rec.Code)
	}
}

// An edit with no fields present is a mistake, not a no-op: saying so is more
// useful than a 200 that changed nothing.
func TestAdminEditRefusesAnEmptyBody(t *testing.T) {
	s := operatorServer()
	r := operatorRequest(http.MethodPatch, "/v1/admin/timelapses/x", `{}`)
	r.SetPathValue("id", "11111111-1111-1111-1111-111111111111")

	if rec := runHandler(t, s.handleAdminEditTimelapse, r); rec.Code != http.StatusBadRequest {
		t.Fatalf("an empty edit got %d, want 400", rec.Code)
	}
}

func TestAdminEditValidatesBeforeItWrites(t *testing.T) {
	s := operatorServer()
	r := operatorRequest(http.MethodPatch, "/v1/admin/timelapses/x", `{"title":"no"}`)
	r.SetPathValue("id", "11111111-1111-1111-1111-111111111111")

	rec := runHandler(t, s.handleAdminEditTimelapse, r)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("a one-character title got %d, want 422", rec.Code)
	}
	var body errorBody
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("error body is not JSON: %v", err)
	}
	if _, ok := body.Error.Fields["title"]; !ok {
		t.Error("the refusal did not name the offending field")
	}
}

// A non-admin never reaches any of this, whatever body they send.
func TestOperatorHandlersRefuseMembers(t *testing.T) {
	s := operatorServer()
	r := httptest.NewRequest(http.MethodGet, "/v1/admin/featured", nil)
	ctx := context.WithValue(r.Context(), userKey, auth.User{
		ID: "member-1", Role: roleMember, Status: "active",
	})

	if rec := runHandler(t, s.handleAdminFeatured, r.WithContext(ctx)); rec.Code != http.StatusForbidden {
		t.Fatalf("a member got %d, want 403", rec.Code)
	}
}

// The reorder endpoint is a permutation, not an append, so a body larger than
// the shelf is refused before anything is written.
func TestReorderRefusesMoreThanTheShelfHolds(t *testing.T) {
	s := operatorServer()
	ids := make([]string, store.MaxFeatured+1)
	for i := range ids {
		ids[i] = "11111111-1111-1111-1111-11111111111" + string(rune('0'+i%10))
	}
	payload, err := json.Marshal(map[string]any{"ids": ids})
	if err != nil {
		t.Fatalf("encode body: %v", err)
	}
	r := operatorRequest(http.MethodPut, "/v1/admin/featured", string(payload))

	if rec := runHandler(t, s.handleAdminReorderFeatured, r); rec.Code != http.StatusBadRequest {
		t.Fatalf("an oversized reorder got %d, want 400", rec.Code)
	}
}

func TestReorderRefusesAMalformedID(t *testing.T) {
	s := operatorServer()
	r := operatorRequest(http.MethodPut, "/v1/admin/featured", `{"ids":["not-a-uuid"]}`)

	if rec := runHandler(t, s.handleAdminReorderFeatured, r); rec.Code != http.StatusNotFound {
		t.Fatalf("a malformed id got %d, want 404", rec.Code)
	}
}
