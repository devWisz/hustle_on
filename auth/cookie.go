package auth

import (
	"net/http"
	"time"
)

// SessionCookie builds the session cookie with the flags that make it useful
// to the browser and useless to everyone else:
//
//   - HttpOnly keeps it out of reach of any script on the page, so an XSS bug
//     cannot exfiltrate a session.
//   - Secure stops it from ever crossing a plaintext connection.
//   - SameSite=Lax blocks cross-site POSTs from carrying it while still letting
//     the emailed login link work on a top-level navigation.
//   - Path=/ and no Domain means host-only; subdomains do not receive it.
func (s *Service) SessionCookie(value string, ttl time.Duration) *http.Cookie {
	return &http.Cookie{
		Name:     s.cfg.CookieName,
		Value:    value,
		Path:     "/",
		Domain:   s.cfg.CookieDomain,
		Expires:  s.now().Add(ttl),
		MaxAge:   int(ttl.Seconds()),
		HttpOnly: true,
		Secure:   s.cfg.Secure,
		SameSite: http.SameSiteLaxMode,
	}
}

// ClearCookie returns a cookie that removes the session from the browser.
func (s *Service) ClearCookie() *http.Cookie {
	return &http.Cookie{
		Name:     s.cfg.CookieName,
		Value:    "",
		Path:     "/",
		Domain:   s.cfg.CookieDomain,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.cfg.Secure,
		SameSite: http.SameSiteLaxMode,
	}
}

// CSRFCookie carries the CSRF token. It is intentionally *not* HttpOnly: the
// frontend must read it to echo the value back in a header, which is the whole
// point of the double-submit pattern.
func (s *Service) CSRFCookie(token string, ttl time.Duration) *http.Cookie {
	return &http.Cookie{
		Name:     s.cfg.CookieName + "_csrf",
		Value:    token,
		Path:     "/",
		Domain:   s.cfg.CookieDomain,
		Expires:  s.now().Add(ttl),
		MaxAge:   int(ttl.Seconds()),
		HttpOnly: false,
		Secure:   s.cfg.Secure,
		SameSite: http.SameSiteLaxMode,
	}
}
