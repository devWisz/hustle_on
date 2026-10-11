package server

import (
	"net/http"
	"strconv"

	"github.com/sardhana/backend/internal/config"
	"github.com/sardhana/backend/internal/ratelimit"
	"github.com/sardhana/backend/pkg/apierr"
)

// Rate limiting is applied per endpoint, not per API.
//
// A single global budget has to be set to whatever the busiest endpoint needs,
// which means the cheapest endpoint to abuse — requesting a sign-in link, which
// sends mail — is allowed as much traffic as reading the feed. Each route in
// routes.go therefore names a budget, and the route table doubles as the rate
// limit policy: a new endpoint cannot be registered without choosing one.
//
// The named budgets below are the whole vocabulary. They are deliberately
// coarse — one per class of work — because a per-path budget would be a hundred
// knobs nobody tunes, and because a class of work is what actually needs
// bounding.
const (
	// budgetRead is for GET endpoints that serve public data. Generous: a page
	// render can fan out into several of these.
	budgetRead = "read"
	// budgetEngage covers the cheap things a reader does often: opening a
	// thread, saving a session, counting a view.
	budgetEngage = "engage"
	// budgetWrite covers creating and editing a creator's own work.
	budgetWrite = "write"
	// budgetUpload covers issuing upload URLs for video, which is the most
	// expensive thing an unprivileged account can ask for.
	budgetUpload = "upload"
	// budgetPoster covers poster-image upload URLs. Separate from video because
	// the cost is different by three orders of magnitude — a poster is at most a
	// few megabytes and only an admin can ask for one — and because a console
	// that refuses the third thumbnail in a row is a console nobody uses.
	budgetPoster = "poster"
	// budgetDonate covers recording a sponsorship intent, which fixes a recipient
	// and an amount server-side and is therefore the expensive, abusable half.
	budgetDonate = "donate"
	// budgetDonateCheck covers confirming one. Separate, because confirming is a
	// poll rather than an action: the browser retries until the chain finalizes,
	// and one confirmation costs a single RPC read.
	budgetDonateCheck = "donate_check"
	// budgetAuth covers asking for a sign-in challenge. It used to be extremely
	// tight because each request sent an email, and the point of the limit was to
	// stop somebody using us to fill a stranger's inbox. With sign-in a wallet
	// signature there is nothing to send and nobody to flood: the request writes
	// one short-lived nonce, and the number of those is already capped per address
	// by MaxChallengeAttempts. What is left is ordinary abuse protection, so the
	// allowance is sized for a person who mistypes, cancels a wallet prompt and
	// tries again — not for a person who must not be allowed a second attempt.
	budgetAuth = "auth"
	// budgetVerify covers spending a sign-in challenge: checking a signature. It is
	// the same size as asking for one, because the distinguishing factor is not
	// that this endpoint is more dangerous — a signature cannot be guessed — but
	// that both are anonymous and both deserve a human-sized allowance. It was half
	// this, which the token bucket turns into a burst of two.
	budgetVerify = "verify"
	// budgetAdmin covers operator console reads. Higher than a public read
	// because the console loads several lists at once.
	budgetAdmin = "admin"
)

// budget is one named allowance and the rule for who it is charged to.
type budget struct {
	name    string
	limiter *ratelimit.Limiter
	// byIPOnly charges the caller's address even when they are signed in. The
	// sign-in endpoints need this: they are anonymous by definition, so keying
	// them on a user id would let one account bypass the limit entirely.
	byIPOnly bool
	// message is what an exhausted caller is told. It says which budget they
	// ran out of, because "try again shortly" on its own is not actionable.
	message string
}

// buildBudgets creates one limiter per budget class.
//
// Each is its own token bucket with its own map, so exhausting the upload budget
// cannot affect reading, and one endpoint's flood cannot evict another's state.
func buildBudgets(cfg config.Config) map[string]*budget {
	mk := func(name string, perMinute int, byIPOnly bool, message string) *budget {
		return &budget{
			name:     name,
			limiter:  ratelimit.New(perMinute),
			byIPOnly: byIPOnly,
			message:  message,
		}
	}
	built := []*budget{
		mk(budgetRead, cfg.RateLimitAnon, false,
			"Too many requests from here. Wait a moment and try again."),
		mk(budgetEngage, cfg.RateLimitEngage, false,
			"Too many requests from here. Wait a moment and try again."),
		mk(budgetWrite, cfg.RateLimitWrite, false,
			"You are publishing faster than the limit allows. Wait a moment and try again."),
		mk(budgetUpload, cfg.RateLimitUpload, false,
			"Too many uploads started from this account. Wait a moment and try again."),
		mk(budgetPoster, cfg.RateLimitPoster, false,
			"Too many poster uploads started from this account. Wait a moment and try again."),
		mk(budgetDonate, cfg.RateLimitDonate, false,
			"Too many sponsorship attempts. Wait a moment and try again."),
		mk(budgetDonateCheck, cfg.RateLimitDonateCheck, false,
			"Too many confirmation attempts. Wait a moment and try again."),
		mk(budgetAuth, cfg.RateLimitAuth, true,
			"Too many sign-in attempts from here. Wait a moment and try again."),
		mk(budgetVerify, cfg.RateLimitAuth, true,
			"Too many sign-in attempts from here. Wait a moment and try again."),
		mk(budgetAdmin, cfg.RateLimitAdmin, false,
			"Too many console requests. Wait a moment and try again."),
	}
	out := make(map[string]*budget, len(built))
	for _, b := range built {
		out[b.name] = b
	}
	return out
}

// route registers a handler against a named budget.
//
// Choosing the budget is not optional and a typo is fatal at startup rather
// than at request time: a route registered with an unknown name would otherwise
// silently serve unlimited traffic, which is the failure mode this whole
// arrangement exists to prevent.
func (s *Server) route(pattern, budgetName string, h handler) {
	b, ok := s.budgets[budgetName]
	if !ok {
		panic("server: route " + pattern + " names an unknown rate limit budget: " + budgetName)
	}
	s.mux.HandleFunc(pattern, s.guard(b, h))
}

// guard applies one budget to one route and publishes the result.
//
// The remaining count and the reset hint go out on every response — including
// successful ones — so a well-behaved client can slow down before it is cut off,
// and a throttled one knows how long to wait instead of retrying in a loop.
func (s *Server) guard(b *budget, h handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		decision := b.limiter.Check(budgetKey(r, b))

		hdr := w.Header()
		hdr.Set("X-RateLimit-Limit", strconv.Itoa(b.limiter.PerMinute()))
		if !decision.Allowed {
			hdr.Set("X-RateLimit-Remaining", "0")
			hdr.Set("Retry-After", strconv.Itoa(int(decision.RetryAfter.Seconds())+1))
			s.writeError(w, r, apierr.TooManyRequests(b.message))
			return
		}
		hdr.Set("X-RateLimit-Remaining", strconv.Itoa(decision.Remaining))

		if err := h(w, r); err != nil {
			s.writeError(w, r, err)
		}
	}
}

// budgetKey names the client a budget is charged to.
//
// The budget's own name is part of the key so that two routes sharing one
// limiter value — the two sign-in endpoints, for instance — still count
// separately if they are ever split apart, and so a key never collides across
// budgets by accident.
func budgetKey(r *http.Request, b *budget) string {
	if !b.byIPOnly {
		if u, ok := currentUser(r); ok {
			return b.name + ":user:" + u.ID
		}
	}
	return b.name + ":ip:" + clientIP(r).String()
}
