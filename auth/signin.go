package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

// ErrSuspended means the account exists but is not allowed to hold a session.
var ErrSuspended = errors.New("auth: account is suspended")

// SignInMessageTemplate is the exact text a wallet is asked to sign.
//
// Every interpolated part matters. The product name and origin make a signature
// meaningless anywhere else — a signature harvested by a lookalike site is over
// text that names this one. The address binds it to the account. The nonce makes
// it single-use. The timestamp makes it expire.
//
// The text is rebuilt on the server from the stored nonce rather than accepted
// from the client, so a caller cannot present a signature over text of their own
// choosing and have it count.
const SignInMessageTemplate = `%s (%s)

Sign in with your Solana wallet.

Address: %s
Nonce: %s
Issued At: %s

This signature proves you control this wallet. It authorises no transfer, moves no funds and costs nothing.`

// SignInChallenge is what the browser needs to ask a wallet to sign: the exact
// bytes, plus the parts it has to echo back at verification.
type SignInChallenge struct {
	Message  string
	Nonce    string
	IssuedAt time.Time
}

// StartSignIn issues a nonce for an address that wants to sign in.
//
// No account is required and none is looked up: the point of this endpoint is
// that the caller may not have one yet. Whether an account exists is decided
// after the signature verifies, which is also why this endpoint cannot be used
// to discover who is registered.
func (s *Service) StartSignIn(ctx context.Context, address string) (SignInChallenge, error) {
	address = strings.TrimSpace(address)
	if err := ValidateSolanaAddress(address); err != nil {
		return SignInChallenge{}, err
	}

	open, err := s.store.CountOpenChallenges(ctx, address, s.now())
	if err != nil {
		return SignInChallenge{}, fmt.Errorf("auth: count challenges: %w", err)
	}
	if open >= s.cfg.MaxChallengeAttempts {
		return SignInChallenge{}, ErrRateLimited
	}

	nonce, err := NewNonce()
	if err != nil {
		return SignInChallenge{}, err
	}
	issuedAt := s.now()
	if err := s.store.CreateWalletChallenge(ctx, WalletChallenge{
		Address:   address,
		Nonce:     nonce,
		Purpose:   PurposeSignIn,
		ExpiresAt: issuedAt.Add(s.cfg.ChallengeTTL),
	}); err != nil {
		return SignInChallenge{}, fmt.Errorf("auth: store challenge: %w", err)
	}

	return SignInChallenge{
		Message:  s.signInMessage(address, nonce, issuedAt),
		Nonce:    nonce,
		IssuedAt: issuedAt,
	}, nil
}

// CompleteSignIn verifies a signature and returns the account it belongs to,
// creating one on the spot the first time an address signs in.
//
// Sign-up and sign-in are the same act. There is nothing to fill in, no link to
// wait for and no password to choose: proving you hold the key is the whole of
// it, and the profile is completed afterwards by the person who now has an
// account to complete it with.
func (s *Service) CompleteSignIn(ctx context.Context, address, nonce, signature string, issuedAt time.Time) (User, error) {
	address = strings.TrimSpace(address)
	if err := ValidateSolanaAddress(address); err != nil {
		return User{}, err
	}
	if nonce == "" {
		return User{}, ErrInvalidToken
	}

	// A wallet cannot sign for a moment that has not happened, and a stale
	// timestamp cannot be used to revive an expired challenge. The window is
	// generous in both directions only because clocks drift.
	now := s.now()
	if issuedAt.After(now.Add(2*time.Minute)) || issuedAt.Before(now.Add(-2*s.cfg.ChallengeTTL)) {
		return User{}, ErrInvalidToken
	}

	// The signature is checked before the nonce is spent, so a wallet that
	// signed slightly different text — a dropped character, a trimmed newline —
	// does not burn the challenge and force the person to start over. The nonce
	// is still single-use: only a verified request reaches the consume below,
	// and a replay loses the race on `consumed_at IS NULL`.
	if err := VerifySolanaSignature(address, s.signInMessage(address, nonce, issuedAt), signature); err != nil {
		return User{}, err
	}
	if err := s.store.ConsumeSignInChallenge(ctx, address, nonce, now); err != nil {
		return User{}, ErrInvalidToken
	}

	user, err := s.store.UserByWallet(ctx, address)
	switch {
	case err == nil:
	case errors.Is(err, ErrNotFound):
		user, err = s.register(ctx, address)
		if err != nil {
			return User{}, err
		}
	default:
		return User{}, fmt.Errorf("auth: look up wallet: %w", err)
	}

	if !user.Active() {
		return User{}, ErrSuspended
	}
	return user, nil
}

// register creates the account an address signs in to for the first time.
//
// The handle is generated rather than asked for. Asking would put a form between
// somebody and the account they just proved they own, and the handle is only
// public decoration anyway — onboarding replaces it a moment later. Collisions
// are handled by retrying rather than by hoping.
func (s *Service) register(ctx context.Context, address string) (User, error) {
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		handle, err := NewHandle()
		if err != nil {
			return User{}, err
		}
		user, err := s.store.CreateUser(ctx, address, handle, handle)
		if err == nil {
			return user, nil
		}
		lastErr = err
		if !errors.Is(err, ErrHandleTaken) {
			return User{}, err
		}
	}
	return User{}, fmt.Errorf("auth: could not allocate a unique handle: %w", lastErr)
}

// signInMessage renders the text to sign. It is the single definition of that
// text; both the challenge and the verification call it, which is what keeps the
// two from drifting apart.
func (s *Service) signInMessage(address, nonce string, issuedAt time.Time) string {
	return fmt.Sprintf(SignInMessageTemplate,
		s.cfg.ProductName,
		strings.TrimRight(s.cfg.AppURL, "/"),
		address,
		nonce,
		issuedAt.UTC().Format(time.RFC3339),
	)
}
