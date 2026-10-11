package auth

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"sync"
	"testing"
	"time"
)

// stubStore is an in-memory Store.
//
// The auth module's rules are the interesting part and they are all about
// sequencing — which check happens before which write. An in-memory store lets a
// test assert exactly that, and the maps make the ordering visible: a nonce is
// either present or it is not.
type stubStore struct {
	mu sync.Mutex

	users    map[string]User   // by id
	walletOf map[string]string // address -> user id
	handles  map[string]bool   // handles already issued

	challenges map[string]WalletChallenge // "address|nonce" -> challenge
	sessions   map[string]Session         // by id
	emails     map[string]string          // email -> user id
	hashes     map[string]string          // user id -> encoded password hash
}

func newStubStore() *stubStore {
	return &stubStore{
		users:      map[string]User{},
		walletOf:   map[string]string{},
		handles:    map[string]bool{},
		challenges: map[string]WalletChallenge{},
		sessions:   map[string]Session{},
		emails:     map[string]string{},
		hashes:     map[string]string{},
	}
}

func challengeKey(address, nonce string) string { return address + "|" + nonce }

// stubHasher satisfies PasswordHasher for tests. It is deliberately not a
// password hash: these tests are about the rules around passwords, and the
// arithmetic is the one part that should be well-reviewed library code rather
// than something reimplemented here and trusted because it passes its own tests.
type stubHasher struct{}

func (stubHasher) Hash(password string) (string, error) {
	sum := sha256.Sum256([]byte("stub:" + password))
	return "stub$" + base64.RawStdEncoding.EncodeToString(sum[:]), nil
}

func (h stubHasher) Verify(encoded, password string) (bool, error) {
	want, err := h.Hash(password)
	if err != nil {
		return false, err
	}
	return subtle.ConstantTimeCompare([]byte(encoded), []byte(want)) == 1, nil
}

func (s *stubStore) UserByID(_ context.Context, id string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return User{}, ErrNotFound
	}
	return u, nil
}

func (s *stubStore) UserByWallet(_ context.Context, address string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id, ok := s.walletOf[address]
	if !ok {
		return User{}, ErrNotFound
	}
	return s.users[id], nil
}

func (s *stubStore) CreateUser(_ context.Context, address, handle, displayName string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.handles[handle] {
		return User{}, ErrHandleTaken
	}
	s.handles[handle] = true
	u := User{
		ID:            fmt.Sprintf("u%d", len(s.users)+1),
		WalletAddress: address,
		Handle:        handle,
		DisplayName:   displayName,
		Role:          "member",
		Status:        "active",
	}
	s.users[u.ID] = u
	s.walletOf[address] = u.ID
	return u, nil
}

func (s *stubStore) CreatePasswordUser(_ context.Context, email, handle, displayName, passwordHash string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.emails == nil {
		s.emails = map[string]string{}
	}
	if _, taken := s.emails[email]; taken {
		return User{}, ErrEmailTaken
	}
	if s.handles[handle] {
		return User{}, ErrHandleTaken
	}
	s.handles[handle] = true
	u := User{
		ID:          fmt.Sprintf("u%d", len(s.users)+1),
		Email:       email,
		Handle:      handle,
		DisplayName: displayName,
		Role:        "member",
		Status:      "active",
	}
	s.users[u.ID] = u
	s.emails[email] = u.ID
	s.hashes[u.ID] = passwordHash
	return u, nil
}

func (s *stubStore) PasswordCredentials(_ context.Context, email string) (User, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id, ok := s.emails[email]
	if !ok {
		return User{}, "", ErrNotFound
	}
	return s.users[id], s.hashes[id], nil
}

func (s *stubStore) SetPasswordHash(_ context.Context, userID, passwordHash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.users[userID]; !ok {
		return ErrNotFound
	}
	s.hashes[userID] = passwordHash
	return nil
}

func (s *stubStore) PromoteToAdmin(_ context.Context, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[userID]
	if !ok {
		return ErrNotFound
	}
	u.Role = "admin"
	s.users[userID] = u
	return nil
}

func (s *stubStore) CreateSession(_ context.Context, sess Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess.ID = fmt.Sprintf("s%d", len(s.sessions)+1)
	s.sessions[sess.ID] = sess
	return nil
}

func (s *stubStore) SessionByHash(context.Context, []byte) (Session, error) {
	return Session{}, ErrNotFound
}

func (s *stubStore) TouchSession(context.Context, string, time.Time) error  { return nil }
func (s *stubStore) RevokeSession(context.Context, []byte, time.Time) error { return nil }
func (s *stubStore) RevokeUserSessions(_ context.Context, userID string, at time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, sess := range s.sessions {
		if sess.UserID != userID || sess.RevokedAt != nil {
			continue
		}
		revoked := at
		sess.RevokedAt = &revoked
		s.sessions[id] = sess
	}
	return nil
}
func (s *stubStore) RevokeOtherSessions(_ context.Context, userID string, keep []byte, at time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, sess := range s.sessions {
		if sess.UserID != userID || at.Before(sess.CreatedAt) {
			continue
		}
		if bytes.Equal(sess.TokenHash, keep) {
			continue
		}
		sess.RevokedAt = &at
		s.sessions[id] = sess
	}
	return nil
}

func (s *stubStore) CreateWalletChallenge(_ context.Context, c WalletChallenge) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.challenges[challengeKey(c.Address, c.Nonce)] = c
	return nil
}

func (s *stubStore) CountOpenChallenges(_ context.Context, address string, now time.Time) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for _, c := range s.challenges {
		if c.Address == address && c.ExpiresAt.After(now) {
			n++
		}
	}
	return n, nil
}

// spendChallenge is the shared implementation of both consume paths: it is the
// only place a nonce leaves the map, so a test can tell whether a failed check
// reached it.
func (s *stubStore) spendChallenge(address, nonce, wantPurpose, wantUser string, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := challengeKey(address, nonce)
	c, ok := s.challenges[key]
	if !ok || c.Purpose != wantPurpose || c.UserID != wantUser || !c.ExpiresAt.After(now) {
		return ErrNotFound
	}
	delete(s.challenges, key)
	return nil
}

func (s *stubStore) ConsumeSignInChallenge(_ context.Context, address, nonce string, now time.Time) error {
	return s.spendChallenge(address, nonce, PurposeSignIn, "", now)
}

func (s *stubStore) ConsumeWalletChallenge(_ context.Context, userID, address, nonce string, now time.Time) error {
	return s.spendChallenge(address, nonce, PurposePayout, userID, now)
}

func (s *stubStore) SetPayoutAddress(context.Context, string, string, time.Time) error { return nil }

// spent reports whether a challenge is still unspent, for tests that assert a
// rejection did not burn it.
func (s *stubStore) spent(address, nonce string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.challenges[challengeKey(address, nonce)]
	return !ok
}

// RevokeOthers is what a password change uses, and the whole point of it is the
// one session it leaves alone: signing somebody out of the device they are holding
// — with no reset link to get back in — would be a punishment, not a protection.
func TestRevokeOthersKeepsExactlyOneSession(t *testing.T) {
	svc, store := newPasswordService(t)
	ctx := context.Background()
	user, err := svc.SignUp(ctx, "Ada", "ada@example.com", "correct horse battery")
	if err != nil {
		t.Fatalf("sign up: %v", err)
	}

	// Three sessions, as if the account were open on three devices.
	const keep = "the-session-holding-the-cookie"
	for _, secret := range []string{keep, "another-device", "a-third-device"} {
		if err := store.CreateSession(ctx, Session{
			UserID: user.ID, TokenHash: Digest(secret), CreatedAt: time.Now(),
		}); err != nil {
			t.Fatalf("create session: %v", err)
		}
	}

	if err := svc.RevokeOthers(ctx, user.ID, keep); err != nil {
		t.Fatalf("revoke others: %v", err)
	}

	store.mu.Lock()
	defer store.mu.Unlock()
	for id, sess := range store.sessions {
		revoked := sess.RevokedAt != nil
		wantRevoked := !bytes.Equal(sess.TokenHash, Digest(keep))
		if revoked != wantRevoked {
			t.Errorf("session %s revoked=%v, want %v", id, revoked, wantRevoked)
		}
	}
}

// A cookie that names no session keeps nothing, because the safe reading of "keep
// this one" when there is no this one is not to keep a stranger's.
func TestRevokeOthersWithoutACookieEndsEverything(t *testing.T) {
	svc, store := newPasswordService(t)
	ctx := context.Background()
	user, err := svc.SignUp(ctx, "Ada", "ada@example.com", "correct horse battery")
	if err != nil {
		t.Fatalf("sign up: %v", err)
	}
	if err := store.CreateSession(ctx, Session{
		UserID: user.ID, TokenHash: Digest("some-session"), CreatedAt: time.Now(),
	}); err != nil {
		t.Fatalf("create session: %v", err)
	}

	if err := svc.RevokeOthers(ctx, user.ID, ""); err != nil {
		t.Fatalf("revoke others: %v", err)
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	for id, sess := range store.sessions {
		if sess.RevokedAt == nil {
			t.Errorf("session %s survived an empty cookie", id)
		}
	}
}
