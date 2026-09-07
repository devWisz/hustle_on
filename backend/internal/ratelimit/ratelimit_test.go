package ratelimit

import "testing"

func TestAllowExhaustsBurstThenRefuses(t *testing.T) {
	l := New(60) // capacity 15
	allowed := 0
	for i := 0; i < 20; i++ {
		if l.Allow("1.2.3.4") {
			allowed++
		}
	}
	if allowed != 15 {
		t.Fatalf("allowed %d requests in a burst, want 15", allowed)
	}
	if l.Allow("1.2.3.4") {
		t.Fatal("limiter allowed a request past the burst")
	}
	// Keys are independent; one noisy client must not lock everyone out.
	if !l.Allow("5.6.7.8") {
		t.Fatal("a different key was blocked")
	}
}
