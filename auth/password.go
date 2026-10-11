package auth

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"
)

// ErrBadCredentials is returned for every failed password attempt: unknown
// address, wrong password, no password set on the account. They are deliberately
// indistinguishable, because telling them apart is exactly what turns a login
// form into a directory of who has an account here.
var ErrBadCredentials = errors.New("auth: email or password is incorrect")

// ErrEmailTaken means an account already exists for that address.
var ErrEmailTaken = errors.New("auth: an account already exists for that email")

// Password hashing lives behind an interface so this package keeps its promise of
// depending only on the standard library.
//
// The rules about what a password may be are here, because they are policy; the
// arithmetic is not, because getting it wrong is the single most expensive
// mistake in this file and it deserves a well-reviewed implementation rather than
// a hand-rolled one. The backend supplies Argon2id.
type PasswordHasher interface {
	// Hash returns an encoded hash that carries its own parameters and salt, so
	// the cost can be raised later without invalidating stored passwords.
	Hash(password string) (string, error)
	// Verify reports whether a password matches an encoded hash.
	Verify(encoded, password string) (bool, error)
}

// Password length bounds. The floor is well above the eight characters that were
// once conventional, because length is the only strength a person reliably gives
// a password. The ceiling exists because hashing is deliberately expensive: an
// unbounded input is a way to make the server do unbounded work per request.
const (
	MinPasswordLength = 10
	MaxPasswordLength = 200
	// MaxEmailLength matches the practical limit for an address and keeps a
	// hostile sign-up from storing something enormous.
	MaxEmailLength = 254
	maxNameLength  = 60
)

// FieldError names the input a message is about.
//
// A sign-up form has to put the message next to the right box, and a caller can
// only do that if the rule that failed says which field it was. Returning a bare
// string pushed that mapping into the handler, which meant the handler had to
// repeat the rules to know where to point — two copies, which drift.
type FieldError struct {
	Field   string
	Message string
}

func (e *FieldError) Error() string { return e.Message }

// FieldOf reports which input an error is about, or the empty string.
func FieldOf(err error) string {
	var fe *FieldError
	if errors.As(err, &fe) {
		return fe.Field
	}
	return ""
}

func fieldProblem(field, message string) error { return &FieldError{Field: field, Message: message} }

// ValidatePassword returns an error describing the first rule the password breaks,
// phrased for the person typing it.
func ValidatePassword(password, email string) error {
	if utf8.RuneCountInString(password) < MinPasswordLength {
		return fieldProblem("password", fmt.Sprintf("Use at least %d characters.", MinPasswordLength))
	}
	if len(password) > MaxPasswordLength {
		return fieldProblem("password", fmt.Sprintf("Use no more than %d characters.", MaxPasswordLength))
	}
	if strings.TrimSpace(password) == "" {
		return fieldProblem("password", "That password is only spaces.")
	}
	// A password equal to the email address is not a password, and it is the
	// first thing anybody would try.
	if email != "" && strings.EqualFold(password, email) {
		return fieldProblem("password", "Choose a password that is not your email address.")
	}
	// One character repeated is long but has no more strength than one character.
	distinct := map[rune]bool{}
	for _, r := range password {
		distinct[r] = true
	}
	if len(distinct) < 4 {
		return fieldProblem("password", "Use a password with more variety than that.")
	}
	if isCommonPassword(password) {
		return fieldProblem("password", "That password is one of the most commonly used ones. Choose another.")
	}
	return nil
}

// commonPasswords are the passwords that appear at the top of every breach corpus.
//
// A short list like this is worth more than it looks. Length rules push people
// towards `passwordpassword`, which is long and worthless, and an attacker's first
// few thousand guesses are always the same words — so refusing them costs nothing
// and removes the attempts that actually succeed against a site like this one. It
// is deliberately small and lowercased: a large list belongs in a file that can be
// updated, and this is a floor rather than a policy.
var commonPasswords = map[string]bool{
	"password": true, "password1": true, "password123": true, "password1234": true,
	"passwordpassword": true, "passw0rd": true, "p@ssw0rd": true, "passwords": true,
	"123456": true, "1234567": true, "12345678": true, "123456789": true,
	"1234567890": true, "12345678910": true, "0123456789": true, "0987654321": true,
	"qwerty": true, "qwerty123": true, "qwertyuiop": true, "qwertyuiop123": true,
	"asdfghjkl": true, "zxcvbnm": true, "1q2w3e4r": true, "1qaz2wsx": true,
	"letmein": true, "letmein123": true, "welcome": true, "welcome1": true,
	"welcome123": true, "admin": true, "admin123": true, "administrator": true,
	"root": true, "toor": true, "guest": true, "test": true, "test123": true,
	"iloveyou": true, "monkey": true, "dragon": true, "sunshine": true,
	"princess": true, "football": true, "baseball": true, "superman": true,
	"trustno1": true, "abc123": true, "abcd1234": true, "a1b2c3d4": true,
	"changeme": true, "secret": true, "secret123": true, "michael": true,
	"hustleon": true, "hustleon123": true, "solana": true, "solana123": true,
	"bitcoin": true, "ethereum": true, "crypto123": true, "blockchain": true,
	"wallet123": true, "metamask": true, "phantom123": true, "satoshinakamoto": true,
	"correcthorsebatterystaple": true, "thisisapassword": true, "mypassword": true,
	"whatever123": true, "nothing123": true, "hello12345": true, "summer2024": true,
	"winter2024": true, "spring2025": true, "summer2025": true, "autumn2025": true,
}

// isCommonPassword compares case-insensitively, and also with digits and symbols
// removed from the ends, because `Password123!` is the same guess as `password`.
func isCommonPassword(password string) bool {
	lower := strings.ToLower(strings.TrimSpace(password))
	if commonPasswords[lower] {
		return true
	}
	trimmed := strings.Trim(lower, "0123456789!@#$%^&*._-")
	return trimmed != "" && commonPasswords[trimmed]
}

// NormalizeEmail trims and lowercases an address so that two spellings of it are
// one account. The database column is citext and would compare them equal anyway;
// normalising here means the value stored is the one people typed the first time,
// rather than whichever casing happened to arrive.
func NormalizeEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" {
		return "", fieldProblem("email", "Enter your email address.")
	}
	if len(email) > MaxEmailLength {
		return "", fieldProblem("email", "That email address is too long.")
	}
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email {
		return "", fieldProblem("email", "Enter a valid email address.")
	}
	// A display-name form like `Ada <ada@example.com>` parses fine but is not an
	// address, and accepting it would store something nobody can sign in with.
	if strings.ContainsAny(email, "<>,\"") {
		return "", fieldProblem("email", "Enter just the email address, without a name around it.")
	}
	return email, nil
}

// ValidateName returns an error if a display name is unusable.
func ValidateName(raw string) (string, error) {
	name := strings.Join(strings.Fields(raw), " ")
	if name == "" {
		return "", fieldProblem("name", "Enter your name.")
	}
	if utf8.RuneCountInString(name) > maxNameLength {
		return "", fieldProblem("name", fmt.Sprintf("Use no more than %d characters.", maxNameLength))
	}
	// A name that is only punctuation renders as an empty-looking profile, and it
	// is cheap to refuse.
	hasLetter := false
	for _, r := range name {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			hasLetter = true
			break
		}
	}
	if !hasLetter {
		return "", fieldProblem("name", "That name needs at least one letter or number.")
	}
	return name, nil
}

// SignUp creates an account from a name, an email address and a password.
//
// It is the same account as one made with a wallet: it can upload, be reviewed and
// be sponsored. A wallet is only needed to receive money, and one can be linked
// later, so this is not a lesser kind of registration.
func (s *Service) SignUp(ctx context.Context, name, email, password string) (User, error) {
	cleanName, err := ValidateName(name)
	if err != nil {
		return User{}, err
	}
	cleanEmail, err := NormalizeEmail(email)
	if err != nil {
		return User{}, err
	}
	if err := ValidatePassword(password, cleanEmail); err != nil {
		return User{}, err
	}

	hash, err := s.hasher.Hash(password)
	if err != nil {
		return User{}, fmt.Errorf("auth: hash password: %w", err)
	}

	// The handle is derived from the name they gave, because they gave one. A wallet
	// sign-in has nothing to derive from and gets a generated placeholder with a
	// profile step to fix it; here the name is real, so the account is complete
	// enough to be credited and there is nothing to make them do afterwards.
	//
	// Suffixes are tried before giving up, because two people called Ada Lovelace is
	// a coincidence, not an error worth showing either of them.
	candidates := handleCandidates(cleanName)
	var lastErr error
	for attempt := 0; attempt < 6; attempt++ {
		var handle string
		if attempt < len(candidates) {
			handle = candidates[attempt]
		} else {
			generated, err := NewHandle()
			if err != nil {
				return User{}, err
			}
			handle = generated
		}
		user, err := s.store.CreatePasswordUser(ctx, cleanEmail, handle, cleanName, hash)
		if err == nil {
			return user, nil
		}
		lastErr = err
		if errors.Is(err, ErrEmailTaken) {
			return User{}, ErrEmailTaken
		}
		if !errors.Is(err, ErrHandleTaken) {
			return User{}, err
		}
	}
	return User{}, fmt.Errorf("auth: could not allocate a unique handle: %w", lastErr)
}

// handleCandidates turns a display name into handles to try, in order.
//
// A handle is a public URL and a credit line, which is why it is derived from what
// the person calls themselves rather than left as `hustler_9f3k`. Everything the
// handle grammar does not allow is dropped rather than transliterated: an accent
// becomes nothing instead of a guessed ASCII approximation, because a wrong name
// is worse than a shorter one.
func handleCandidates(name string) []string {
	var b strings.Builder
	lastUnderscore := false
	for _, r := range strings.ToLower(name) {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
			lastUnderscore = false
		case r == ' ' || r == '_' || r == '-' || r == '.' || r == '\'':
			if !lastUnderscore && b.Len() > 0 {
				b.WriteByte('_')
				lastUnderscore = true
			}
		}
	}
	base := strings.Trim(b.String(), "_")
	// The column requires 3 to 30 characters; anything outside that has to be
	// fixed here rather than rejected by the database.
	if len(base) > 30 {
		base = strings.Trim(base[:30], "_")
	}
	if len(base) < 3 {
		return nil
	}
	return []string{base, base + "_1", base + "_2", base + "_3"}
}

// LogIn verifies an email address and password and returns the account.
func (s *Service) LogIn(ctx context.Context, email, password string) (User, error) {
	cleanEmail, err := NormalizeEmail(email)
	if err != nil {
		// A malformed address is not worth a database round trip, but the answer
		// is the same one a wrong password gets.
		return User{}, ErrBadCredentials
	}

	user, encoded, err := s.store.PasswordCredentials(ctx, cleanEmail)
	switch {
	case err == nil:
	case errors.Is(err, ErrNotFound):
		// Spend the same work as a real verify before refusing, so the response
		// time does not say whether the address exists. Without this, the login
		// form answers the question the error message carefully does not.
		if s.dummyHash != "" {
			_, _ = s.hasher.Verify(s.dummyHash, password)
		}
		return User{}, ErrBadCredentials
	default:
		return User{}, fmt.Errorf("auth: look up email: %w", err)
	}

	if encoded == "" {
		// An account that exists but has only ever used a wallet. Told the same
		// thing as a wrong password, for the same reason.
		_, _ = s.hasher.Verify(s.dummyHash, password)
		return User{}, ErrBadCredentials
	}

	ok, err := s.hasher.Verify(encoded, password)
	if err != nil {
		return User{}, fmt.Errorf("auth: verify password: %w", err)
	}
	if !ok {
		return User{}, ErrBadCredentials
	}
	if !user.Active() {
		return User{}, ErrSuspended
	}
	return user, nil
}

// SetPassword changes the password on an account that has one, and is how a
// password gets set on an account that does not.
//
// It requires the current password when there is one. Without that, a session left
// open on a shared machine would be enough to lock the owner out of their own
// account — which matters more here than usual, because there is no reset link to
// fall back on.
func (s *Service) SetPassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	user, err := s.store.UserByID(ctx, userID)
	if err != nil {
		return err
	}
	if user.Email == "" {
		return errors.New("auth: this account has no email address to attach a password to")
	}
	if err := ValidatePassword(newPassword, user.Email); err != nil {
		return err
	}

	_, encoded, err := s.store.PasswordCredentials(ctx, user.Email)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return err
	}
	if encoded != "" {
		ok, err := s.hasher.Verify(encoded, currentPassword)
		if err != nil {
			return fmt.Errorf("auth: verify password: %w", err)
		}
		if !ok {
			return ErrBadCredentials
		}
	}

	hash, err := s.hasher.Hash(newPassword)
	if err != nil {
		return fmt.Errorf("auth: hash password: %w", err)
	}
	return s.store.SetPasswordHash(ctx, userID, hash)
}
