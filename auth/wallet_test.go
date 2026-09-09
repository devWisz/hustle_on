package auth

import (
	"crypto/ed25519"
	"testing"

	"github.com/sardhana/auth/internal/base58"
)

func TestVerifySolanaSignature(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	address := base58.Encode(pub)
	message := "Sardhana wallet verification\n\nNonce: abc123"
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
	for _, in := range [][]byte{{}, {0}, {0, 0, 1}, []byte("sardhana")} {
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
