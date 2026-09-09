// Package validate holds the input rules shared by every handler. Validation
// happens once, at the edge, before a value reaches the database or the chain.
package validate

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/sardhana/backend/pkg/apierr"
)

var (
	handleRE = regexp.MustCompile(`^[a-z0-9_]{3,30}$`)
	slugRE   = regexp.MustCompile(`^[a-z0-9-]{6,90}$`)
	uuidRE   = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

	// The two link fields are pinned to the hosts the product actually shows.
	// A free-form URL here would be rendered as a link on a public page, which
	// is how a submission form becomes somebody else's traffic funnel.
	githubRE = regexp.MustCompile(`^https://github\.com/[A-Za-z0-9._/-]{1,180}$`)
	xRE      = regexp.MustCompile(`^https://(x|twitter)\.com/[A-Za-z0-9._/-]{1,180}$`)
)

// Errors accumulates field messages so a form can be corrected in one pass
// rather than one field per round trip.
type Errors struct {
	fields map[string]string
}

func New() *Errors { return &Errors{fields: map[string]string{}} }

func (e *Errors) Add(field, message string) *Errors {
	if _, exists := e.fields[field]; !exists {
		e.fields[field] = message
	}
	return e
}

func (e *Errors) Any() bool { return len(e.fields) > 0 }

// Err returns a validation *apierr.Error, or nil when everything passed.
func (e *Errors) Err() error {
	if !e.Any() {
		return nil
	}
	out := apierr.Validation("Some fields need attention.")
	for k, v := range e.fields {
		out.WithField(k, v)
	}
	return out
}

// Required checks that a trimmed string is non-empty.
func (e *Errors) Required(field, value string) *Errors {
	if strings.TrimSpace(value) == "" {
		e.Add(field, "This field is required.")
	}
	return e
}

// Length checks rune count, not byte count, so multi-byte text is measured the
// way the person typing it would count it.
func (e *Errors) Length(field, value string, min, max int) *Errors {
	n := utf8.RuneCountInString(strings.TrimSpace(value))
	switch {
	case n < min:
		e.Add(field, "Too short.")
	case n > max:
		e.Add(field, "Too long.")
	}
	return e
}

func (e *Errors) Handle(field, value string) *Errors {
	if !handleRE.MatchString(value) {
		e.Add(field, "Use 3 to 30 characters: lowercase letters, numbers or underscore.")
	} else if reservedHandles[value] {
		e.Add(field, "That handle is reserved.")
	}
	return e
}

func (e *Errors) UUID(field, value string) *Errors {
	if !uuidRE.MatchString(value) {
		e.Add(field, "Not a valid identifier.")
	}
	return e
}

// GitHubURL accepts an empty value or a github.com address. Both link fields
// are optional: a creator with nothing public to point at should still be able
// to publish.
func (e *Errors) GitHubURL(field, value string) *Errors {
	if value != "" && !githubRE.MatchString(value) {
		e.Add(field, "Enter a full https://github.com/… address.")
	}
	return e
}

// XURL accepts an empty value or an x.com (or legacy twitter.com) address.
func (e *Errors) XURL(field, value string) *Errors {
	if value != "" && !xRE.MatchString(value) {
		e.Add(field, "Enter a full https://x.com/… address.")
	}
	return e
}

// Range checks a bounded integer, such as the length of a work session.
func (e *Errors) Range(field string, value, min, max int) *Errors {
	if value < min || value > max {
		e.Add(field, "Value is out of range.")
	}
	return e
}

func (e *Errors) PositiveAmount(field string, lamports int64) *Errors {
	switch {
	case lamports <= 0:
		e.Add(field, "Amount must be greater than zero.")
	case lamports > 1_000_000_000_000_000: // one million SOL, a sanity ceiling
		e.Add(field, "Amount is out of range.")
	}
	return e
}

// IsUUID reports whether s is a well-formed UUID.
func IsUUID(s string) bool { return uuidRE.MatchString(s) }

// IsSlug reports whether s is a well-formed URL slug.
func IsSlug(s string) bool { return slugRE.MatchString(s) }

// Slugify turns a title into a URL-safe slug. Callers append a short random
// suffix to guarantee uniqueness.
func Slugify(title string) string {
	var b strings.Builder
	lastDash := true
	for _, r := range strings.ToLower(strings.TrimSpace(title)) {
		switch {
		case unicode.IsLetter(r) && r < unicode.MaxASCII, unicode.IsDigit(r) && r < unicode.MaxASCII:
			b.WriteRune(r)
			lastDash = false
		case !lastDash && b.Len() < 60:
			b.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(b.String(), "-")
}

// CleanText normalises user-submitted prose: trims, collapses runs of blank
// lines and strips control characters that have no business in a text field.
func CleanText(s string) string {
	s = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' {
			return r
		}
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
	for strings.Contains(s, "\n\n\n") {
		s = strings.ReplaceAll(s, "\n\n\n", "\n\n")
	}
	return strings.TrimSpace(s)
}

// reservedHandles are route names and role words that must not become profiles.
var reservedHandles = map[string]bool{
	"admin": true, "api": true, "auth": true, "login": true, "logout": true,
	"signup": true, "settings": true, "support": true, "help": true,
	"about": true, "terms": true, "privacy": true,
	"sardhana": true, "upload": true, "watch": true, "timelapse": true,
	"creator": true, "dashboard": true, "review": true,
	"static": true, "assets": true, "media": true, "www": true, "root": true,
}
