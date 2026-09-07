package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strings"
)

// CSRFHeader is the header the frontend echoes the CSRF cookie back in.
const CSRFHeader = "X-Sardhana-CSRF"

// CSRFToken derives a token bound to a session. Because it is an HMAC of the
// session digest, an attacker who can guess or plant a cookie value still
// cannot produce the matching token without the server key.
func (s *Service) CSRFToken(sessionValue string) string {
	mac := hmac.New(sha256.New, s.cfg.CSRFKey)
	mac.Write([]byte("csrf:v1:"))
	mac.Write(Digest(sessionValue))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// CheckCSRF validates a state-changing request.
//
// Two independent checks have to pass. The Origin (or Referer) must be one of
// ours, which stops the request at the browser boundary, and the header must
// match the token derived from this exact session, which stops anything that
// managed to get past it.
func (s *Service) CheckCSRF(r *http.Request, allowedOrigins []string) error {
	switch r.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return nil // Safe methods must not change state.
	}

	origin := r.Header.Get("Origin")
	if origin == "" {
		if ref := r.Header.Get("Referer"); ref != "" {
			if i := strings.Index(ref, "/"); i > 0 {
				if j := strings.Index(ref[i+2:], "/"); j >= 0 {
					origin = ref[:i+2+j]
				} else {
					origin = ref
				}
			}
		}
	}
	if origin == "" || !originAllowed(origin, allowedOrigins) {
		return ErrCSRF
	}

	// Anonymous requests (requesting a login link, verifying one) have no
	// session to bind a token to. The origin check above is what protects
	// them; demanding a token here would make signing in impossible.
	c, err := r.Cookie(s.cfg.CookieName)
	if err != nil || c.Value == "" {
		return nil
	}
	presented := r.Header.Get(CSRFHeader)
	if presented == "" {
		return ErrCSRF
	}
	if !hmac.Equal([]byte(presented), []byte(s.CSRFToken(c.Value))) {
		return ErrCSRF
	}
	return nil
}

func originAllowed(origin string, allowed []string) bool {
	for _, a := range allowed {
		if strings.EqualFold(strings.TrimRight(a, "/"), strings.TrimRight(origin, "/")) {
			return true
		}
	}
	return false
}

// ErrCSRF is returned when a state-changing request fails origin or token checks.
var ErrCSRF = errConst("auth: csrf check failed")

type errConst string

func (e errConst) Error() string { return string(e) }
