// Package auth implements passwordless authentication for Hustle On: email
// magic links, opaque server-side sessions, CSRF tokens and Solana wallet
// ownership proofs. It depends only on the standard library.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
)

// tokenBytes is the entropy behind every magic link and session token.
// 32 bytes is well beyond what an online guessing attack can reach, and the
// stored digest means a database leak does not yield usable tokens.
const tokenBytes = 32

var (
	// ErrInvalidToken covers every failure mode of a presented token:
	// malformed, unknown, expired, already used or revoked. Callers must not
	// distinguish between them in responses, since the difference is exactly
	// what an attacker probes for.
	ErrInvalidToken = errors.New("auth: invalid token")
	ErrRateLimited  = errors.New("auth: too many requests")
	ErrNotFound     = errors.New("auth: not found")
)

// NewToken returns a URL-safe secret and its digest. The secret is shown to the
// user exactly once; only the digest is ever persisted.
func NewToken() (secret string, digest []byte, err error) {
	buf := make([]byte, tokenBytes)
	if _, err = rand.Read(buf); err != nil {
		return "", nil, fmt.Errorf("auth: read entropy: %w", err)
	}
	secret = base64.RawURLEncoding.EncodeToString(buf)
	return secret, Digest(secret), nil
}

// Digest hashes a presented secret for lookup. SHA-256 is the right tool here
// rather than a password hash: the input is already high-entropy, so stretching
// buys nothing and would only slow every request down.
func Digest(secret string) []byte {
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

// EqualDigest compares two digests in constant time.
func EqualDigest(a, b []byte) bool {
	return subtle.ConstantTimeCompare(a, b) == 1
}

// NewNonce returns a short random string for wallet signing challenges.
func NewNonce() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("auth: read entropy: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
