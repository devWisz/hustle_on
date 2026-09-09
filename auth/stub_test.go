package auth

import (
	"context"
	"time"
)

// stubStore satisfies Store for tests that never reach persistence.
type stubStore struct{}

func (stubStore) UserByID(context.Context, string) (User, error)    { return User{}, ErrNotFound }
func (stubStore) UserByEmail(context.Context, string) (User, error) { return User{}, ErrNotFound }
func (stubStore) CreateUser(context.Context, string, string, string) (User, error) {
	return User{}, ErrNotFound
}
func (stubStore) MarkEmailVerified(context.Context, string, time.Time) error { return nil }
func (stubStore) CreateMagicLink(context.Context, MagicLink) error           { return nil }
func (stubStore) ConsumeMagicLink(context.Context, []byte, time.Time) (MagicLink, error) {
	return MagicLink{}, ErrInvalidToken
}
func (stubStore) CountRecentMagicLinks(context.Context, string, time.Time) (int, error) {
	return 0, nil
}
func (stubStore) CreateSession(context.Context, Session) error { return nil }
func (stubStore) SessionByHash(context.Context, []byte) (Session, error) {
	return Session{}, ErrNotFound
}
func (stubStore) TouchSession(context.Context, string, time.Time) error        { return nil }
func (stubStore) RevokeSession(context.Context, []byte, time.Time) error       { return nil }
func (stubStore) RevokeUserSessions(context.Context, string, time.Time) error  { return nil }
func (stubStore) CreateWalletChallenge(context.Context, WalletChallenge) error { return nil }
func (stubStore) ConsumeWalletChallenge(context.Context, string, string, string, time.Time) error {
	return nil
}
func (stubStore) SetPayoutAddress(context.Context, string, string, time.Time) error { return nil }

// discard swallows development email output in tests.
type discard struct{}

func (discard) Write(p []byte) (int, error) { return len(p), nil }
