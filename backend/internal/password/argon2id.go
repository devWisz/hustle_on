// Package password implements password hashing.
//
// It lives here rather than in the auth module because that module depends only
// on the standard library, and because getting this wrong is the most expensive
// mistake in the whole authentication path. The rules about what a password may
// be are policy and live in the auth module; the arithmetic is here, on top of a
// well-reviewed implementation.
package password

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Parameters for Argon2id.
//
// Argon2id is the current recommendation for new passwords: it is memory-hard, so
// the cost of a guessing attack is dominated by RAM rather than by raw compute,
// which is what makes GPUs and purpose-built crackers bad at it.
//
// 64 MiB with three passes takes on the order of fifty milliseconds on a normal
// machine. That is slow enough to matter to somebody guessing and fast enough that
// signing in does not feel broken. Parallelism is 1 deliberately: concurrency in
// the hash multiplies memory use under load, and the API serves many requests at
// once — a per-request 128 MiB spike is how a login form becomes a denial of
// service against itself.
const (
	defaultMemory      = 64 * 1024 // KiB, so 64 MiB
	defaultIterations  = 3
	defaultParallelism = 1
	saltLength         = 16
	keyLength          = 32
)

// Bounds on the parameters read back out of a stored hash. A hash comes from our
// own database, but parsing it must not be a way to make this process allocate
// arbitrarily much memory if that database is ever tampered with.
const (
	maxMemory      = 1 << 20 // 1 GiB
	maxIterations  = 10
	maxParallelism = 16
)

// Hasher encodes and verifies passwords in the standard PHC string format:
//
//	$argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>
//
// The parameters travel with the hash, which is what allows the cost to be raised
// later without invalidating a single stored password.
type Hasher struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
}

// New returns a Hasher with the parameters above.
func New() *Hasher {
	return &Hasher{
		Memory:      defaultMemory,
		Iterations:  defaultIterations,
		Parallelism: defaultParallelism,
	}
}

// Hash returns an encoded hash for a password.
func (h *Hasher) Hash(password string) (string, error) {
	salt := make([]byte, saltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("password: read salt: %w", err)
	}
	sum := argon2.IDKey([]byte(password), salt, h.Iterations, h.Memory, h.Parallelism, keyLength)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, h.Memory, h.Iterations, h.Parallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(sum),
	), nil
}

// ErrMalformed is returned when a stored hash cannot be understood. It is an
// error rather than a silent false because it means the row is wrong, and
// reporting it as a failed login would hide a corrupted account behind "wrong
// password" forever.
var ErrMalformed = errors.New("password: stored hash is not in the expected format")

// Verify reports whether a password matches an encoded hash, using the parameters
// that hash was created with.
func (h *Hasher) Verify(encoded, password string) (bool, error) {
	parts := strings.Split(encoded, "$")
	// "", "argon2id", "v=19", "m=..,t=..,p=..", salt, hash
	if len(parts) != 6 || parts[0] != "" || parts[1] != "argon2id" {
		return false, ErrMalformed
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return false, ErrMalformed
	}
	if version != argon2.Version {
		return false, fmt.Errorf("password: unsupported argon2 version %d", version)
	}

	var memory, iterations uint32
	var parallelism uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism); err != nil {
		return false, ErrMalformed
	}
	if memory > maxMemory || iterations > maxIterations || parallelism > maxParallelism || parallelism == 0 {
		return false, ErrMalformed
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, ErrMalformed
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, ErrMalformed
	}

	got := argon2.IDKey([]byte(password), salt, iterations, memory, parallelism, uint32(len(want)))
	// Constant time: a comparison that returns early leaks how much of the hash
	// was right, which is a real attack against a value an attacker can choose.
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}
