// Package auth implements authentication for Hustle On: sign-in by Solana
// wallet signature, opaque server-side sessions, CSRF tokens and wallet
// ownership proofs. It depends only on the standard library.
//
// There is no password anywhere in it, and no email. A password would be a
// secret we would have to store and could lose; an email link would make a
// third party's mail delivery a precondition of signing in. A signature needs
// neither: the key never leaves the wallet, and the only thing the server keeps
// is a public address it has already seen prove itself.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"errors"
	"fmt"
	"unicode/utf8"
)

// tokenBytes is the entropy behind every session token. 32 bytes is well beyond
// what an online guessing attack can reach, and the stored digest means a
// database leak does not yield usable tokens.
const tokenBytes = 32

var (
	// ErrInvalidToken covers every failure mode of a presented token:
	// malformed, unknown, expired, already used or revoked. Callers must not
	// distinguish between them in responses, since the difference is exactly
	// what an attacker probes for.
	ErrInvalidToken = errors.New("auth: invalid token")
	ErrRateLimited  = errors.New("auth: too many requests")
	ErrNotFound     = errors.New("auth: not found")
	ErrHandleTaken  = errors.New("auth: handle already taken")
)

// NewToken returns a URL-safe secret and its digest. The secret is sent to the
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

// truncate shortens a string to at most n bytes.
//
// User agents arrive unbounded from the network and are stored, so they are
// clipped before they reach the database. It cuts on a rune boundary so a
// multi-byte character is never left half-written.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	for n > 0 && !utf8.RuneStart(s[n]) {
		n--
	}
	return s[:n]
}

// handleEncoding produces the alphabet a generated handle is drawn from. Lower
// case base32 without padding uses only a-z and 2-7, all of which the handle
// check constraint accepts.
var handleEncoding = base32.NewEncoding("abcdefghijklmnopqrstuvwxyz234567").WithPadding(base32.NoPadding)

// NewHandle returns a placeholder handle for a brand new account.
//
// It is prefixed so a generated handle is obvious as one — both to the person
// who is about to replace it and to anyone reading the member list — and long
// enough that guessing a live one is not worth trying.
func NewHandle() (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("auth: read entropy: %w", err)
	}
	return "hustler_" + handleEncoding.EncodeToString(buf)[:10], nil
}
