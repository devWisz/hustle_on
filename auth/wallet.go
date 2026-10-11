package auth

import (
	"context"
	"crypto/ed25519"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/sardhana/auth/base58"
)

// ErrBadSignature means the presented proof does not verify for the address.
var ErrBadSignature = errors.New("auth: wallet signature does not verify")

// WalletProofTemplate is the exact text the wallet is asked to sign. It names
// the site and includes a server nonce, so a signature harvested by another
// application cannot be replayed here.
const WalletProofTemplate = `Hustle On wallet verification

Address: %s
Nonce: %s
Issued: %s

Signing this message proves you control this wallet. It authorises no transfer.`

// StartWalletLink issues a nonce for the user to sign with their wallet.
func (s *Service) StartWalletLink(ctx context.Context, userID, address string) (message, nonce string, err error) {
	if err := ValidateSolanaAddress(address); err != nil {
		return "", "", err
	}
	nonce, err = NewNonce()
	if err != nil {
		return "", "", err
	}
	now := s.now()
	challenge := WalletChallenge{
		UserID:    userID,
		Address:   address,
		Nonce:     nonce,
		Purpose:   PurposePayout,
		ExpiresAt: now.Add(10 * time.Minute),
	}
	if err := s.store.CreateWalletChallenge(ctx, challenge); err != nil {
		return "", "", fmt.Errorf("auth: store challenge: %w", err)
	}
	return fmt.Sprintf(WalletProofTemplate, address, nonce, now.UTC().Format(time.RFC3339)), nonce, nil
}

// CompleteWalletLink verifies the signature and records the payout address.
//
// The message is rebuilt on the server from the stored nonce rather than taken
// from the client, so a caller cannot get a signature over text of their
// choosing accepted as a proof of ownership.
func (s *Service) CompleteWalletLink(ctx context.Context, userID, address, nonce, signatureB58 string, issuedAt time.Time) error {
	if err := ValidateSolanaAddress(address); err != nil {
		return err
	}
	now := s.now()
	message := fmt.Sprintf(WalletProofTemplate, address, nonce, issuedAt.UTC().Format(time.RFC3339))

	// The signature is checked before the nonce is spent.
	//
	// It used to be the other way round, which meant a single rejected attempt —
	// a wallet that signed slightly different text, a copy-paste that lost a
	// character — consumed the challenge and made the person start over. Checking
	// first costs nothing: the nonce is still single-use, because the only path
	// that reaches the consume below is one that has already verified, and a
	// second request with the same signature loses the race on `consumed_at IS
	// NULL` and is refused there.
	if err := VerifySolanaSignature(address, message, signatureB58); err != nil {
		return err
	}
	if err := s.store.ConsumeWalletChallenge(ctx, userID, address, nonce, now); err != nil {
		return ErrInvalidToken
	}
	if err := s.store.SetPayoutAddress(ctx, userID, address, now); err != nil {
		return fmt.Errorf("auth: set payout address: %w", err)
	}
	return nil
}

// VerifySolanaSignature checks an ed25519 signature made by a Solana address
// over message. Both address and signature are base58, as wallets emit them.
func VerifySolanaSignature(address, message, signatureB58 string) error {
	pub, err := base58.Decode(address)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return ErrBadSignature
	}
	sig, err := base58.Decode(signatureB58)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return ErrBadSignature
	}
	if !ed25519.Verify(ed25519.PublicKey(pub), []byte(message), sig) {
		return ErrBadSignature
	}
	return nil
}

// ValidateSolanaAddress checks that a string decodes to a 32-byte public key.
// Length alone is not enough: base58 strings of the right length can still
// decode to the wrong number of bytes.
func ValidateSolanaAddress(address string) error {
	if l := len(strings.TrimSpace(address)); l < 32 || l > 44 {
		return errors.New("auth: wallet address is not valid")
	}
	raw, err := base58.Decode(address)
	if err != nil || len(raw) != ed25519.PublicKeySize {
		return errors.New("auth: wallet address is not valid")
	}
	return nil
}

// ValidateSignature checks that a string is a base58-encoded ed25519 signature.
//
// It exists so a malformed signature is refused at the edge with a message the
// person can act on, rather than being handed to an RPC node that answers with
// an opaque "invalid param" the API can only report as its own failure.
func ValidateSignature(signature string) error {
	raw, err := base58.Decode(strings.TrimSpace(signature))
	if err != nil || len(raw) != ed25519.SignatureSize {
		return errors.New("auth: transaction signature is not valid")
	}
	return nil
}
