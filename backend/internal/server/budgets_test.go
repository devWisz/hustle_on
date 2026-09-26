package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sardhana/backend/internal/ratelimit"
)

// okHandler is a handler that succeeds, for driving the guard directly.
func okHandler(w http.ResponseWriter, r *http.Request) error {
	w.WriteHeader(http.StatusOK)
	return nil
}

// Each budget is its own bucket: exhausting the upload allowance must leave
// reading, writing and donating untouched. This is the whole reason the limit
// is per endpoint rather than per API.
func TestBudgetsAreIndependent(t *testing.T) {
	s := testServer()
	s.budgets[budgetUpload].limiter = ratelimit.New(4) // burst of 1

	upload := s.guard(s.budgets[budgetUpload], okHandler)
	read := s.guard(s.budgets[budgetRead], okHandler)

	rec := httptest.NewRecorder()
	upload.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/uploads", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("first upload got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	upload.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/uploads", nil))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second upload got %d, want 429", rec.Code)
	}

	rec = httptest.NewRecorder()
	read.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/timelapses", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("a read was throttled by the upload budget: got %d", rec.Code)
	}
}

// A throttled response says which budget was spent and how long to wait, and a
// successful one says how much is left, so a client can back off before it is
// cut off rather than retrying blind.
func TestGuardPublishesTheBudget(t *testing.T) {
	s := testServer()
	b := s.budgets[budgetEngage]
	b.limiter = ratelimit.New(4) // burst of 1
	handler := s.guard(b, okHandler)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/timelapses/x/views", nil))
	if got := rec.Header().Get("X-RateLimit-Limit"); got != "4" {
		t.Errorf("X-RateLimit-Limit = %q, want 4", got)
	}
	if got := rec.Header().Get("X-RateLimit-Remaining"); got != "0" {
		t.Errorf("X-RateLimit-Remaining = %q, want 0", got)
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/v1/timelapses/x/views", nil))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second request got %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Error("no Retry-After on a throttled response")
	}
}

// The sign-in budget is charged to the address even for a signed-in caller.
// Keying it on the account would let an attacker with one session send as many
// sign-in emails as they liked, which is exactly what this budget prevents.
func TestSignInBudgetsIgnoreTheAccount(t *testing.T) {
	s := testServer()
	s.budgets[budgetAuth].limiter = ratelimit.New(4) // burst of 1
	handler := s.guard(s.budgets[budgetAuth], okHandler)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, asUser(httptest.NewRequest(http.MethodPost, "/v1/auth/request-link", nil), "user-a"))
	if rec.Code != http.StatusOK {
		t.Fatalf("first request got %d", rec.Code)
	}

	// A different account, same address: still the same budget.
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, asUser(httptest.NewRequest(http.MethodPost, "/v1/auth/request-link", nil), "user-b"))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second account from the same address got %d, want 429", rec.Code)
	}
}

// Routes that are not reads still get separate budgets per caller, so one
// member's publishing cannot throttle another's.
func TestWriteBudgetIsChargedPerCaller(t *testing.T) {
	s := testServer()
	s.budgets[budgetWrite].limiter = ratelimit.New(4) // burst of 1
	handler := s.guard(s.budgets[budgetWrite], okHandler)

	for _, id := range []string{"author-a", "author-b"} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, asUser(httptest.NewRequest(http.MethodPost, "/v1/timelapses", nil), id))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s got %d — one member's writes throttled another's", id, rec.Code)
		}
	}
}

// A route table entry naming a budget that does not exist must fail at startup.
// Registering it unlimited would be a silent hole, which is worse than a crash.
func TestUnknownBudgetPanicsAtRegistration(t *testing.T) {
	s := testServer()
	s.mux = http.NewServeMux()
	defer func() {
		if recover() == nil {
			t.Fatal("a route with an unknown budget was registered without complaint")
		}
	}()
	s.route("GET /v1/nope", "no-such-budget", okHandler)
}
