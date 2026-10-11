package auth

import (
	"context"
	"crypto/ed25519"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/sardhana/auth/base58"
)

const testAppURL = "https://hustleon.com"

// signInFixture is a service, a store and a keypair that can actually sign —
// enough to exercise sign-in the way a wallet does.
type signInFixture struct {
	svc   *Service
	store *stubStore
	priv  ed25519.PrivateKey
	addr  string
	now   time.Time
}

func newSignInFixture(t *testing.T) *signInFixture {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	store := newStubStore()
	svc, err := NewService(Config{
		AppURL:      testAppURL,
		ProductName: "Hustle On",
		CSRFKey:     []byte("0123456789abcdef0123456789abcdef"),
	}, store)
	if err != nil {
		t.Fatalf("build service: %v", err)
	}
	now := time.Date(2026, 3, 4, 5, 6, 7, 0, time.UTC)
	svc.SetClock(func() time.Time { return now })
	return &signInFixture{svc: svc, store: store, priv: priv, addr: base58.Encode(pub), now: now}
}

func (f *signInFixture) sign(t *testing.T, message string) string {
	t.Helper()
	return base58.Encode(ed25519.Sign(f.priv, []byte(message)))
}

// signIn runs the whole flow the browser runs and returns the account.
func (f *signInFixture) signIn(t *testing.T) User {
	t.Helper()
	challenge, err := f.svc.StartSignIn(context.Background(), f.addr)
	if err != nil {
		t.Fatalf("start sign-in: %v", err)
	}
	user, err := f.svc.CompleteSignIn(context.Background(), f.addr,
		challenge.Nonce, f.sign(t, challenge.Message), challenge.IssuedAt)
	if err != nil {
		t.Fatalf("complete sign-in: %v", err)
	}
	return user
}

func TestSignInCreatesAnAccountOnFirstUse(t *testing.T) {
	f := newSignInFixture(t)
	user := f.signIn(t)

	if user.WalletAddress != f.addr {
		t.Errorf("account wallet = %q, want %q", user.WalletAddress, f.addr)
	}
	if !user.Active() {
		t.Errorf("a freshly created account is not active: %+v", user)
	}
	// The handle is generated, so it must satisfy the same rule the database
	// enforces, or the insert would have failed at the constraint instead.
	if !strings.HasPrefix(user.Handle, "hustler_") || len(user.Handle) > 30 {
		t.Errorf("generated handle %q is not a plausible placeholder", user.Handle)
	}
}

func TestSignInIsIdempotentForTheSameWallet(t *testing.T) {
	f := newSignInFixture(t)
	first := f.signIn(t)

	// A second sign-in is the same flow, and must land on the same account
	// rather than minting a duplicate one.
	challenge, err := f.svc.StartSignIn(context.Background(), f.addr)
	if err != nil {
		t.Fatalf("start second sign-in: %v", err)
	}
	second, err := f.svc.CompleteSignIn(context.Background(), f.addr,
		challenge.Nonce, f.sign(t, challenge.Message), challenge.IssuedAt)
	if err != nil {
		t.Fatalf("complete second sign-in: %v", err)
	}
	if first.ID != second.ID {
		t.Fatalf("signing in twice produced two accounts: %s and %s", first.ID, second.ID)
	}
	if len(f.store.users) != 1 {
		t.Fatalf("store holds %d accounts, want 1", len(f.store.users))
	}
}

// The signed text must name the site. Without it, a signature collected by a
// lookalike domain would be a valid proof here, because nothing in the bytes
// would say which site they were for.
func TestTheSignedMessageNamesTheSiteAndTheNonce(t *testing.T) {
	f := newSignInFixture(t)
	challenge, err := f.svc.StartSignIn(context.Background(), f.addr)
	if err != nil {
		t.Fatalf("start sign-in: %v", err)
	}
	for _, want := range []string{testAppURL, f.addr, challenge.Nonce, "no transfer"} {
		if !strings.Contains(challenge.Message, want) {
			t.Errorf("the message to sign does not contain %q", want)
		}
	}
}

func TestForeignKeySignatureIsRejected(t *testing.T) {
	f := newSignInFixture(t)
	challenge, err := f.svc.StartSignIn(context.Background(), f.addr)
	if err != nil {
		t.Fatalf("start sign-in: %v", err)
	}
	_, otherPriv, _ := ed25519.GenerateKey(nil)
	forged := base58.Encode(ed25519.Sign(otherPriv, []byte(challenge.Message)))

	_, err = f.svc.CompleteSignIn(context.Background(), f.addr,
		challenge.Nonce, forged, challenge.IssuedAt)
	if !errors.Is(err, ErrBadSignature) {
		t.Fatalf("a signature from another key gave %v, want ErrBadSignature", err)
	}
	if len(f.store.users) != 0 {
		t.Fatal("a rejected signature created an account")
	}
}

// A rejected signature must not cost the person their challenge. Wallets sign
// slightly different text more often than anyone would like, and being sent back
// to fetch a fresh nonce for a stray newline is pure friction — the nonce is
// single-use either way.
func TestARejectedSignatureDoesNotSpendTheChallenge(t *testing.T) {
	f := newSignInFixture(t)
	challenge, err := f.svc.StartSignIn(context.Background(), f.addr)
	if err != nil {
		t.Fatalf("start sign-in: %v", err)
	}

	wrong := f.sign(t, challenge.Message+" ")
	if _, err := f.svc.CompleteSignIn(context.Background(), f.addr,
		challenge.Nonce, wrong, challenge.IssuedAt); err == nil {
		t.Fatal("a signature over different text was accepted")
	}
	if f.store.spent(f.addr, challenge.Nonce) {
		t.Fatal("a rejected signature burned the nonce")
	}

	// The very same nonce still works with the correct signature.
	if _, err := f.svc.CompleteSignIn(context.Background(), f.addr,
		challenge.Nonce, f.sign(t, challenge.Message), challenge.IssuedAt); err != nil {
		t.Fatalf("the same nonce was refused after a failed attempt: %v", err)
	}
}

// A captured signature must not be replayable. This is the property the whole
// scheme rests on: the signature is not a secret, so it may only be usable once.
func TestANonceCannotBeReplayed(t *testing.T) {
	f := newSignInFixture(t)
	challenge, err := f.svc.StartSignIn(context.Background(), f.addr)
	if err != nil {
		t.Fatalf("start sign-in: %v", err)
	}
	signature := f.sign(t, challenge.Message)

	if _, err := f.svc.CompleteSignIn(context.Background(), f.addr,
		challenge.Nonce, signature, challenge.IssuedAt); err != nil {
		t.Fatalf("the first use failed: %v", err)
	}
	if _, err := f.svc.CompleteSignIn(context.Background(), f.addr,
		challenge.Nonce, signature, challenge.IssuedAt); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("the replay gave %v, want ErrInvalidToken", err)
	}
}

// A signature is only meaningful for the address inside it. Presenting a valid
// signature for address A while claiming address B must not work, or one person
// could sign in as another.
func TestASignatureIsBoundToItsAddress(t *testing.T) {
	f := newSignInFixture(t)
	challenge, err := f.svc.StartSignIn(context.Background(), f.addr)
	if err != nil {
		t.Fatalf("start sign-in: %v", err)
	}
	signature := f.sign(t, challenge.Message)

	_, otherPub, _ := ed25519.GenerateKey(nil)
	otherAddr := base58.Encode(otherPub)
	if _, err := f.svc.CompleteSignIn(context.Background(), otherAddr,
		challenge.Nonce, signature, challenge.IssuedAt); err == nil {
		t.Fatal("a signature was accepted for a different address")
	}
}

func TestAnExpiredChallengeIsRefused(t *testing.T) {
	f := newSignInFixture(t)
	challenge, err := f.svc.StartSignIn(context.Background(), f.addr)
	if err != nil {
		t.Fatalf("start sign-in: %v", err)
	}
	signature := f.sign(t, challenge.Message)

	// Move the clock past the challenge window. The signature is still
	// cryptographically valid; only time has passed.
	later := f.now.Add(DefaultChallengeTTL(t) + time.Minute)
	f.svc.SetClock(func() time.Time { return later })

	if _, err := f.svc.CompleteSignIn(context.Background(), f.addr,
		challenge.Nonce, signature, challenge.IssuedAt); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("an expired challenge gave %v, want ErrInvalidToken", err)
	}
}

// DefaultChallengeTTL exposes the configured window to the test without
// hard-coding it twice.
func DefaultChallengeTTL(t *testing.T) time.Duration {
	t.Helper()
	var c Config
	c.withDefaults()
	return c.ChallengeTTL
}

func TestASuspendedAccountCannotSignIn(t *testing.T) {
	f := newSignInFixture(t)
	user := f.signIn(t)

	suspended := f.store.users[user.ID]
	suspended.Status = "suspended"
	f.store.users[user.ID] = suspended

	challenge, err := f.svc.StartSignIn(context.Background(), f.addr)
	if err != nil {
		t.Fatalf("start sign-in: %v", err)
	}
	_, err = f.svc.CompleteSignIn(context.Background(), f.addr,
		challenge.Nonce, f.sign(t, challenge.Message), challenge.IssuedAt)
	if !errors.Is(err, ErrSuspended) {
		t.Fatalf("a suspended account signed in: %v", err)
	}
}

// A sign-in nonce and a payout nonce are not interchangeable. Signing in does
// not silently re-point where money is sent, and a payout proof cannot mint a
// session. This is enforced where it matters — in the statement that spends the
// nonce — rather than by trusting the caller to ask the right question.
func TestChallengePurposesAreNotInterchangeable(t *testing.T) {
	f := newSignInFixture(t)
	ctx := context.Background()

	signin, err := f.svc.StartSignIn(ctx, f.addr)
	if err != nil {
		t.Fatalf("start sign-in: %v", err)
	}
	if err := f.store.ConsumeWalletChallenge(ctx, "u1", f.addr, signin.Nonce, f.now); err == nil {
		t.Fatal("the payout path spent a sign-in challenge")
	}
	if err := f.store.ConsumeSignInChallenge(ctx, f.addr, signin.Nonce, f.now); err != nil {
		t.Fatalf("the sign-in path refused its own challenge: %v", err)
	}
}

// The end-to-end version of the same rule: a wallet that signs the payout text
// must not get a session out of it.
func TestAPayoutProofCannotMintASession(t *testing.T) {
	f := newSignInFixture(t)
	user := f.signIn(t)

	message, nonce, err := f.svc.StartWalletLink(context.Background(), user.ID, f.addr)
	if err != nil {
		t.Fatalf("start wallet link: %v", err)
	}
	if _, err := f.svc.CompleteSignIn(context.Background(), f.addr,
		nonce, f.sign(t, message), f.now); err == nil {
		t.Fatal("a payout signature was accepted as a sign-in")
	}
}

func TestChallengeRequestsAreCappedPerAddress(t *testing.T) {
	f := newSignInFixture(t)
	var c Config
	c.withDefaults()
	for i := 0; i < c.MaxChallengeAttempts; i++ {
		if _, err := f.svc.StartSignIn(context.Background(), f.addr); err != nil {
			t.Fatalf("challenge %d was refused early: %v", i, err)
		}
	}
	if _, err := f.svc.StartSignIn(context.Background(), f.addr); !errors.Is(err, ErrRateLimited) {
		t.Fatalf("the cap gave %v, want ErrRateLimited", err)
	}
}

func TestAnInvalidAddressIsRefusedBeforeAnythingIsStored(t *testing.T) {
	f := newSignInFixture(t)
	for _, bad := range []string{"", "not-an-address", "0OIl-not-base58-at-all-really"} {
		if _, err := f.svc.StartSignIn(context.Background(), bad); err == nil {
			t.Errorf("StartSignIn(%q) was accepted", bad)
		}
	}
	if len(f.store.challenges) != 0 {
		t.Fatalf("an invalid address stored %d challenges", len(f.store.challenges))
	}
}
