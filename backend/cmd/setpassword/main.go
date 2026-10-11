// Command setpassword creates or updates a password account.
//
// It exists because there is no sign-up path for the first operator, and because
// nothing sends email — there is no invitation link to click and no reset flow to
// fall back on. Setting a password is therefore an operator action, run against
// the database directly, by someone who already has access to the machine.
//
// It is also the only place a password is ever printed. Everywhere else it is
// hashed on arrival and never returned.
//
// Usage:
//
//	go run ./cmd/setpassword --email you@example.com [--name "Your Name"] [--admin]
//
// With no --password it generates one and prints it once. Pass --password to
// choose your own, in which case it is subject to the same rules the sign-up form
// enforces.
package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/sardhana/auth"
	"github.com/sardhana/backend/internal/config"
	"github.com/sardhana/backend/internal/db"
	"github.com/sardhana/backend/internal/password"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	email := flag.String("email", "", "the address to set a password for (required)")
	chosen := flag.String("password", "", "the password to set; generated when empty")
	name := flag.String("name", "", "display name; defaults to the part before the @")
	handle := flag.String("handle", "", "handle; defaults to a generated one for a new account")
	admin := flag.Bool("admin", false, "also grant the operator role")
	flag.Parse()

	if strings.TrimSpace(*email) == "" {
		return errors.New("--email is required")
	}
	cleanEmail, err := auth.NormalizeEmail(*email)
	if err != nil {
		return err
	}

	displayName := strings.TrimSpace(*name)
	if displayName == "" {
		local, _, _ := strings.Cut(cleanEmail, "@")
		displayName = local
	}
	displayName, err = auth.ValidateName(displayName)
	if err != nil {
		return err
	}

	plain := *chosen
	generated := false
	if plain == "" {
		plain, err = generatePassword()
		if err != nil {
			return err
		}
		generated = true
	}
	if err := auth.ValidatePassword(plain, cleanEmail); err != nil {
		return err
	}

	cfg, err := config.Load()
	if err != nil {
		// A missing unrelated production variable (storage, mainnet) must not stop
		// an operator from setting a password, so only the connection matters here.
		if cfg.DatabaseURL == "" {
			return err
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL, 2)
	if err != nil {
		return err
	}
	defer pool.Close()

	hasher := password.New()
	hash, err := hasher.Hash(plain)
	if err != nil {
		return err
	}

	// An existing account is updated rather than duplicated, so this is safe to run
	// again on the same address — which is how a forgotten password is changed,
	// there being no reset link.
	var existingID string
	err = pool.QueryRow(ctx, `SELECT id::text FROM users WHERE email = $1`, cleanEmail).Scan(&existingID)
	switch {
	case err == nil:
		role := "user"
		if *admin {
			role = "admin"
			if _, err := pool.Exec(ctx, `UPDATE users SET role = 'admin' WHERE id = $1`, existingID); err != nil {
				return err
			}
		}
		if _, err := pool.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, existingID, hash); err != nil {
			return err
		}
		fmt.Printf("updated the password for %s (role: %s)\n", cleanEmail, role)
	case isNoRows(err):
		userHandle := strings.TrimSpace(*handle)
		if userHandle == "" {
			userHandle, err = auth.NewHandle()
			if err != nil {
				return err
			}
		}
		role := "member"
		if *admin {
			role = "admin"
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO users (email, password_hash, handle, display_name, role)
			VALUES ($1, $2, $3, $4, $5::user_role)`,
			cleanEmail, hash, userHandle, displayName, role); err != nil {
			return err
		}
		fmt.Printf("created %s with handle %q (role: %s)\n", cleanEmail, userHandle, role)
	default:
		return err
	}

	fmt.Printf("\n  email:    %s\n  password: %s\n", cleanEmail, plain)
	if generated {
		fmt.Println("\nThis is the only time the password is shown. Store it somewhere safe.")
	} else {
		fmt.Println("\nThe password you chose has been set.")
	}
	return nil
}

// generatePassword returns a random password that satisfies the same rules the
// sign-up form enforces, so a generated one is never rejected by the validator
// that guards the form.
func generatePassword() (string, error) {
	buf := make([]byte, 18)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read entropy: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// isNoRows reports whether a query found nothing, without this command having to
// import the driver's error type or the store's error vocabulary.
func isNoRows(err error) bool {
	return err != nil && strings.Contains(err.Error(), "no rows in result set")
}
