package auth

import (
	"context"
	"crypto/ed25519"
	"fmt"
	"testing"
	"time"

	"github.com/sardhana/auth/internal/base58"
)

func TestVerifySolanaSignature(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	address := base58.Encode(pub)
	message := "Hustle On wallet verification\n\nNonce: abc123"
	signature := base58.Encode(ed25519.Sign(priv, []byte(message)))

	if err := VerifySolanaSignature(address, message, signature); err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
	// A signature over different text must not verify: this is what stops a
	// signature captured elsewhere from being replayed as a proof here.
	if err := VerifySolanaSignature(address, message+" tampered", signature); err == nil {
		t.Fatal("signature verified against a modified message")
	}
	otherPub, _, _ := ed25519.GenerateKey(nil)
	if err := VerifySolanaSignature(base58.Encode(otherPub), message, signature); err == nil {
		t.Fatal("signature verified for the wrong address")
	}
}

func TestValidateSolanaAddress(t *testing.T) {
	pub, _, _ := ed25519.GenerateKey(nil)
	if err := ValidateSolanaAddress(base58.Encode(pub)); err != nil {
		t.Fatalf("valid address rejected: %v", err)
	}
	for _, bad := range []string{"", "short", "0OIl_not_base58_alphabet_at_all_xxxxx", base58.Encode(pub[:16])} {
		if err := ValidateSolanaAddress(bad); err == nil {
			t.Errorf("ValidateSolanaAddress(%q) accepted an invalid address", bad)
		}
	}
}

func TestBase58RoundTrip(t *testing.T) {
	for _, in := range [][]byte{{}, {0}, {0, 0, 1}, []byte("hustleon")} {
		encoded := base58.Encode(in)
		out, err := base58.Decode(encoded)
		if err != nil {
			t.Fatalf("decode(%q): %v", encoded, err)
		}
		if string(out) != string(in) {
			t.Errorf("round trip changed %v into %v", in, out)
		}
	}
}

func TestValidateSignature(t *testing.T) {
	// 64 zero bytes is a structurally valid signature: this checks the encoding,
	// not whether any such transaction exists.
	valid := base58.Encode(make([]byte, ed25519.SignatureSize))
	if err := ValidateSignature(valid); err != nil {
		t.Errorf("a well-formed signature was rejected: %v", err)
	}
	// Right length as a string, wrong length once decoded — which is exactly the
	// case that reaches an RPC node as an unhelpful "invalid param".
	for _, bad := range []string{
		"",
		"not base58 at all!",
		base58.Encode(make([]byte, 32)),
		"4pRtHJ2vLpQxMk9nWfYbZcAe6TgUdSvRnKmJhGfDsAqWeRtYuIoPlKjHgFdSaZxCvBnM1234567",
	} {
		if err := ValidateSignature(bad); err == nil {
			t.Errorf("signature %q was accepted", bad)
		}
	}
}

// recordingWalletStore counts what the link flow asked it to do, so a test can
// tell "refused" from "refused and spent the nonce anyway".
type recordingWalletStore struct {
	stubStore
	consumed int
	linked   int
}

func (s *recordingWalletStore) ConsumeWalletChallenge(context.Context, string, string, string, time.Time) error {
	s.consumed++
	return nil
}

func (s *recordingWalletStore) SetPayoutAddress(context.Context, string, string, time.Time) error {
	s.linked++
	return nil
}

// A rejected signature must not cost the person their challenge. Wallets sign
// slightly different text more often than anyone would like — a stray newline, a
// truncated paste — and being sent back to request a fresh nonce for it is pure
// friction, since the nonce is single-use either way.
func TestARejectedPayoutSignatureDoesNotSpendTheChallenge(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	address := base58.Encode(pub)
	issued := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	const nonce = "nonce-1"
	message := fmt.Sprintf(WalletProofTemplate, address, nonce, issued.Format(time.RFC3339))

	store := &recordingWalletStore{}
	svc, err := NewService(Config{
		AppURL:  "https://hustleon.com",
		CSRFKey: []byte("0123456789abcdef0123456789abcdef"),
	}, store)
	if err != nil {
		t.Fatalf("build service: %v", err)
	}
	svc.SetClock(func() time.Time { return issued.Add(time.Minute) })

	wrong := base58.Encode(ed25519.Sign(priv, []byte(message+" tampered")))
	if err := svc.CompleteWalletLink(context.Background(), "u1", address, nonce, wrong, issued); err == nil {
		t.Fatal("a signature over different text was accepted")
	}
	if store.consumed != 0 {
		t.Fatalf("the challenge was consumed by a rejected attempt (%d times)", store.consumed)
	}

	right := base58.Encode(ed25519.Sign(priv, []byte(message)))
	if err := svc.CompleteWalletLink(context.Background(), "u1", address, nonce, right, issued); err != nil {
		t.Fatalf("the same nonce was refused after a failed attempt: %v", err)
	}
	if store.consumed != 1 || store.linked != 1 {
		t.Fatalf("successful link consumed=%d linked=%d, want 1 and 1", store.consumed, store.linked)
	}
}
