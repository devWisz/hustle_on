package auth

import (
	"context"
	"fmt"
	"sync"
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
}

func newStubStore() *stubStore {
	return &stubStore{
		users:      map[string]User{},
		walletOf:   map[string]string{},
		handles:    map[string]bool{},
		challenges: map[string]WalletChallenge{},
		sessions:   map[string]Session{},
	}
}

func challengeKey(address, nonce string) string { return address + "|" + nonce }

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

func (s *stubStore) TouchSession(context.Context, string, time.Time) error       { return nil }
func (s *stubStore) RevokeSession(context.Context, []byte, time.Time) error      { return nil }
func (s *stubStore) RevokeUserSessions(context.Context, string, time.Time) error { return nil }

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
