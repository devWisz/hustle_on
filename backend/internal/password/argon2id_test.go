package password

import (
	"strings"
	"testing"
)

func TestHashAndVerify(t *testing.T) {
	h := New()
	encoded, err := h.Hash("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if !strings.HasPrefix(encoded, "$argon2id$v=19$m=65536,t=3,p=1$") {
		t.Fatalf("unexpected encoding: %s", encoded)
	}

	ok, err := h.Verify(encoded, "correct horse battery staple")
	if err != nil || !ok {
		t.Fatalf("the right password did not verify: %v %v", ok, err)
	}
	ok, err = h.Verify(encoded, "correct horse battery stapl")
	if err != nil || ok {
		t.Fatalf("a near miss verified: %v %v", ok, err)
	}
}

// The same password must produce a different hash every time, or the store would
// reveal which accounts share a password.
func TestTheSamePasswordHashesDifferently(t *testing.T) {
	h := New()
	first, err := h.Hash("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	second, err := h.Hash("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if first == second {
		t.Fatal("two hashes of one password are identical, so the salt is not random")
	}
}

// A cost raise must not invalidate passwords already stored: verification uses
// the parameters recorded in the hash, not the hasher's current ones.
func TestVerifyUsesTheParametersInTheHash(t *testing.T) {
	old := &Hasher{Memory: 8 * 1024, Iterations: 1, Parallelism: 1}
	encoded, err := old.Hash("correct horse battery staple")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	// A differently configured hasher, as a future deployment would have.
	raised := &Hasher{Memory: 64 * 1024, Iterations: 3, Parallelism: 1}
	if ok, err := raised.Verify(encoded, "correct horse battery staple"); err != nil || !ok {
		t.Fatalf("an old hash stopped verifying after a cost change: %v %v", ok, err)
	}
}

func TestMalformedHashesAreReportedNotGuessed(t *testing.T) {
	h := New()
	for _, bad := range []string{
		"",
		"not a hash",
		"$argon2i$v=19$m=65536,t=3,p=1$c2FsdA$aGFzaA",
		"$argon2id$v=19$m=65536,t=3,p=1$not-base64!$aGFzaA",
		"$argon2id$v=19$m=99999999,t=3,p=1$c2FsdA$aGFzaA",
		"$argon2id$v=19$m=65536,t=999,p=1$c2FsdA$aGFzaA",
	} {
		if _, err := h.Verify(bad, "anything"); err == nil {
			t.Errorf("%q was accepted as a valid hash", bad)
		}
	}
}
