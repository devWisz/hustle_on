package auth

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func newPasswordService(t *testing.T) (*Service, *stubStore) {
	t.Helper()
	store := newStubStore()
	svc, err := NewService(Config{
		AppURL:      testAppURL,
		ProductName: "Hustle On",
		CSRFKey:     []byte("0123456789abcdef0123456789abcdef"),
	}, store, stubHasher{})
	if err != nil {
		t.Fatalf("build service: %v", err)
	}
	return svc, store
}

func TestValidatePasswordRules(t *testing.T) {
	good := "correct horse battery staple"
	if err := ValidatePassword(good, "ada@example.com"); err != nil {
		t.Fatalf("a fine password was refused: %v", err)
	}

	for _, tc := range []struct {
		name     string
		password string
		email    string
	}{
		{"too short", "short1!", "ada@example.com"},
		{"only spaces", strings.Repeat(" ", 20), "ada@example.com"},
		{"the email address itself", "ada@example.com", "ada@example.com"},
		{"the email in another case", "ADA@Example.com", "ada@example.com"},
		{"one character repeated", strings.Repeat("a", 30), "ada@example.com"},
		{"too long", strings.Repeat("ab", MaxPasswordLength), "ada@example.com"},
	} {
		if err := ValidatePassword(tc.password, tc.email); err == nil {
			t.Errorf("%s was accepted", tc.name)
		}
	}
}

func TestNormalizeEmail(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"  Ada@Example.COM ", "ada@example.com"},
		{"ada@example.com", "ada@example.com"},
	} {
		got, err := NormalizeEmail(tc.in)
		if err != nil || got != tc.want {
			t.Errorf("NormalizeEmail(%q) = %q, %v; want %q", tc.in, got, err, tc.want)
		}
	}
	for _, bad := range []string{
		"",
		"not-an-address",
		"Ada <ada@example.com>",
		"ada@example.com, eve@example.com",
		"@example.com",
	} {
		if _, err := NormalizeEmail(bad); err == nil {
			t.Errorf("NormalizeEmail(%q) was accepted", bad)
		}
	}
}

func TestValidateName(t *testing.T) {
	if got, err := ValidateName("  Ada   Lovelace  "); err != nil || got != "Ada Lovelace" {
		t.Errorf("a normal name = %q, %v", got, err)
	}
	for _, bad := range []string{"", "   ", "...", strings.Repeat("a", maxNameLength+1)} {
		if _, err := ValidateName(bad); err == nil {
			t.Errorf("name %q was accepted", bad)
		}
	}
}

func TestSignUpThenLogIn(t *testing.T) {
	svc, _ := newPasswordService(t)
	ctx := context.Background()

	created, err := svc.SignUp(ctx, "Ada Lovelace", "Ada@Example.com", "correct horse battery")
	if err != nil {
		t.Fatalf("sign up: %v", err)
	}
	if created.Email != "ada@example.com" {
		t.Errorf("the stored address was not normalised: %q", created.Email)
	}
	if created.DisplayName != "Ada Lovelace" {
		t.Errorf("display name = %q", created.DisplayName)
	}
	if created.Handle != "ada_lovelace" {
		t.Errorf("handle = %q, want it derived from the name", created.Handle)
	}
	if created.WalletAddress != "" {
		t.Errorf("a password sign-up should not invent a wallet: %q", created.WalletAddress)
	}

	// The address is matched case-insensitively, because citext makes the two
	// spellings one account.
	user, err := svc.LogIn(ctx, "ADA@example.com", "correct horse battery")
	if err != nil {
		t.Fatalf("log in: %v", err)
	}
	if user.ID != created.ID {
		t.Fatalf("logged into %s, want %s", user.ID, created.ID)
	}
}

func TestLogInRefusalsAreIndistinguishable(t *testing.T) {
	svc, _ := newPasswordService(t)
	ctx := context.Background()
	if _, err := svc.SignUp(ctx, "Ada", "ada@example.com", "correct horse battery"); err != nil {
		t.Fatalf("sign up: %v", err)
	}

	for _, tc := range []struct{ name, email, password string }{
		{"wrong password", "ada@example.com", "wrong horse battery"},
		{"unknown address", "nobody@example.com", "correct horse battery"},
		{"malformed address", "not-an-address", "correct horse battery"},
	} {
		_, err := svc.LogIn(ctx, tc.email, tc.password)
		if !errors.Is(err, ErrBadCredentials) {
			t.Errorf("%s gave %v, want ErrBadCredentials — the three must be indistinguishable", tc.name, err)
		}
	}
}

// An account that has only ever signed in with a wallet has no password, so a
// password attempt against it must fail the same way a wrong password does — not
// with a message that confirms the address exists.
func TestAnAccountWithoutAPasswordCannotLogInWithOne(t *testing.T) {
	svc, store := newPasswordService(t)
	ctx := context.Background()
	if _, err := store.CreateUser(ctx, "SomeWalletAddress1111111111111111111111111", "walletuser", "Wallet User"); err != nil {
		t.Fatalf("create wallet account: %v", err)
	}
	// Give it an email but no password, which is what linking a contact address
	// would look like.
	store.mu.Lock()
	for id, u := range store.users {
		u.Email = "wallet@example.com"
		store.users[id] = u
		store.emails["wallet@example.com"] = id
	}
	store.mu.Unlock()

	if _, err := svc.LogIn(ctx, "wallet@example.com", "anything at all here"); !errors.Is(err, ErrBadCredentials) {
		t.Fatalf("got %v, want ErrBadCredentials", err)
	}
}

func TestSignUpRefusesADuplicateEmail(t *testing.T) {
	svc, _ := newPasswordService(t)
	ctx := context.Background()
	if _, err := svc.SignUp(ctx, "Ada", "ada@example.com", "correct horse battery"); err != nil {
		t.Fatalf("first sign up: %v", err)
	}
	_, err := svc.SignUp(ctx, "Someone Else", "ADA@example.com", "a different long password")
	if !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("got %v, want ErrEmailTaken", err)
	}
}

func TestASuspendedAccountCannotLogIn(t *testing.T) {
	svc, store := newPasswordService(t)
	ctx := context.Background()
	created, err := svc.SignUp(ctx, "Ada", "ada@example.com", "correct horse battery")
	if err != nil {
		t.Fatalf("sign up: %v", err)
	}
	suspended := store.users[created.ID]
	suspended.Status = "suspended"
	store.users[created.ID] = suspended

	if _, err := svc.LogIn(ctx, "ada@example.com", "correct horse battery"); !errors.Is(err, ErrSuspended) {
		t.Fatalf("got %v, want ErrSuspended", err)
	}
}

func TestSetPasswordRequiresTheCurrentOne(t *testing.T) {
	svc, _ := newPasswordService(t)
	ctx := context.Background()
	user, err := svc.SignUp(ctx, "Ada", "ada@example.com", "correct horse battery")
	if err != nil {
		t.Fatalf("sign up: %v", err)
	}

	// A session alone must not be enough to take the account over — there is no
	// reset link to recover it with afterwards.
	if err := svc.SetPassword(ctx, user.ID, "not the current one", "a brand new password"); !errors.Is(err, ErrBadCredentials) {
		t.Fatalf("changing without the current password gave %v, want ErrBadCredentials", err)
	}
	if _, err := svc.LogIn(ctx, "ada@example.com", "correct horse battery"); err != nil {
		t.Fatalf("the old password stopped working after a refused change: %v", err)
	}

	if err := svc.SetPassword(ctx, user.ID, "correct horse battery", "a brand new password"); err != nil {
		t.Fatalf("change password: %v", err)
	}
	if _, err := svc.LogIn(ctx, "ada@example.com", "a brand new password"); err != nil {
		t.Fatalf("the new password does not work: %v", err)
	}
	if _, err := svc.LogIn(ctx, "ada@example.com", "correct horse battery"); !errors.Is(err, ErrBadCredentials) {
		t.Fatalf("the old password still works after a change: %v", err)
	}
}

// The denylist is small on purpose, so it has to be right about what it covers:
// the exact strings, the same string in another case, and the same word with the
// digits and punctuation people put on the end to satisfy a length rule.
func TestCommonPasswordsAreRefused(t *testing.T) {
	for _, pw := range []string{
		"password123",
		"Password123",
		"PASSWORD",
		"password123!",
		"qwertyuiop",
		"letmein123",
		"hustleon123",
		"solana123",
		"correcthorsebatterystaple",
	} {
		if err := ValidatePassword(pw, "ada@example.com"); err == nil {
			t.Errorf("%q was accepted", pw)
		}
	}
	// And it must not refuse things that merely look like a word on the list.
	for _, pw := range []string{
		"my own long passphrase about a horse",
		"Tr0ub4dor&3-correct-battery",
		"passwords are not the same as password",
	} {
		if err := ValidatePassword(pw, "ada@example.com"); err != nil {
			t.Errorf("%q was refused: %v", pw, err)
		}
	}
}
