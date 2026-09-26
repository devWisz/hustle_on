// Package ratelimit provides an in-memory token bucket keyed by client.
//
// This is deliberately per-process: it is the last line of defence behind an
// edge rate limiter, and it protects the database from a single misbehaving
// client. A multi-instance deployment should also enforce limits at the edge.
package ratelimit

import (
	"sync"
	"time"
)

type bucket struct {
	tokens   float64
	lastFill time.Time
}

// Limiter is a keyed token bucket, safe for concurrent use.
type Limiter struct {
	mu        sync.Mutex
	buckets   map[string]*bucket
	rate      float64 // tokens added per second
	capacity  float64
	perMinute int
	lastGC    time.Time
}

// Decision is the outcome of one check: whether the request may proceed, what
// is left of the caller's budget, and how long to wait if it may not.
type Decision struct {
	Allowed    bool
	Remaining  int
	RetryAfter time.Duration
}

// New builds a limiter allowing perMinute requests per key, bursting to
// perMinute/4 (minimum 1) so a page that fires several parallel requests is
// not punished for it.
func New(perMinute int) *Limiter {
	if perMinute < 1 {
		perMinute = 1
	}
	capacity := float64(perMinute) / 4
	if capacity < 1 {
		capacity = 1
	}
	return &Limiter{
		buckets:   make(map[string]*bucket),
		rate:      float64(perMinute) / 60,
		capacity:  capacity,
		perMinute: perMinute,
		lastGC:    time.Now(),
	}
}

// PerMinute is the configured budget, published to clients so a rate-limited
// caller can see what it is being held to rather than guessing.
func (l *Limiter) PerMinute() int { return l.perMinute }

// Allow consumes a token for key, reporting whether the request may proceed.
func (l *Limiter) Allow(key string) bool { return l.Check(key).Allowed }

// Check consumes a token for key and reports the resulting budget.
//
// It is the single implementation behind Allow; the extra return values exist
// so a handler can say how much of the budget is left and when to come back,
// which is the difference between a client that backs off and one that retries
// immediately and is throttled again.
func (l *Limiter) Check(key string) Decision {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	l.gc(now)
	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.capacity, lastFill: now}
		l.buckets[key] = b
	}
	b.tokens += now.Sub(b.lastFill).Seconds() * l.rate
	if b.tokens > l.capacity {
		b.tokens = l.capacity
	}
	b.lastFill = now

	if b.tokens < 1 {
		return Decision{
			Allowed:    false,
			Remaining:  0,
			RetryAfter: time.Duration((1 - b.tokens) / l.rate * float64(time.Second)),
		}
	}
	b.tokens--
	return Decision{Allowed: true, Remaining: int(b.tokens)}
}

// RetryAfter estimates the wait until one token is available.
func (l *Limiter) RetryAfter(key string) time.Duration {
	l.mu.Lock()
	defer l.mu.Unlock()
	b, ok := l.buckets[key]
	if !ok || b.tokens >= 1 {
		return 0
	}
	return time.Duration((1 - b.tokens) / l.rate * float64(time.Second))
}

// gc drops idle buckets so the map cannot grow without bound under a spray of
// distinct keys.
func (l *Limiter) gc(now time.Time) {
	if now.Sub(l.lastGC) < time.Minute {
		return
	}
	l.lastGC = now
	idle := time.Duration(l.capacity/l.rate)*time.Second + 5*time.Minute
	for k, b := range l.buckets {
		if now.Sub(b.lastFill) > idle {
			delete(l.buckets, k)
		}
	}
}
