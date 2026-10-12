package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net"
	"net/http"
	"net/url"
	"strings"
)

// CSRFHeader is the header the frontend echoes the CSRF cookie back in.
const CSRFHeader = "X-Hustleon-CSRF"

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
	if !OriginAllowed(origin, allowedOrigins, s.cfg.AllowLocalOrigins) {
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

// OriginAllowed reports whether a request's origin is one this deployment serves.
//
// The comparison is exact, with two deliberate exceptions.
//
// The first is that the loopback spellings are one address. `localhost`,
// `127.0.0.1` and `[::1]` are one server, and which of them a browser, a dev server
// or a printed URL happens to use is not a security-relevant distinction — but it
// is the difference between a site that works and one where every write is
// refused, because reads are not origin-checked and the page itself loads
// perfectly. That exception is confined to loopback on both sides.
//
// The second is allowLocalNetwork, which is set only outside production. A dev
// server prints a "Network" URL alongside the local one — `next dev` prints
// `http://192.168.1.132:3001` — and that is the URL people copy, because it is the
// one that works from a phone. Refusing it means the site appears completely
// broken while every request is in fact arriving from the developer's own machine.
// When this is on, any http(s) origin on a loopback, private or link-local address
// is accepted, on any port.
//
// The gate matters more than the exception. In production this is always false and
// the allowlist is matched exactly, because there the list of origins is the list
// of domains we serve and loosening it would be the vulnerability rather than the
// fix. Nothing here ever matches a public host loosely.
func OriginAllowed(origin string, allowed []string, allowLocalNetwork bool) bool {
	o := strings.TrimRight(strings.TrimSpace(origin), "/")
	if o == "" {
		return false
	}
	if allowLocalNetwork && isLocalNetworkOrigin(o) {
		return true
	}
	for _, a := range allowed {
		a = strings.TrimRight(strings.TrimSpace(a), "/")
		if strings.EqualFold(a, o) {
			return true
		}
		if sameLoopbackService(a, o) {
			return true
		}
	}
	return false
}

// isLocalNetworkOrigin reports whether an origin points at this machine or the
// network it is on: loopback, an RFC 1918 private range, or a link-local address.
func isLocalNetworkOrigin(origin string) bool {
	_, host, _, ok := splitOrigin(origin)
	if !ok || host == "" {
		return false
	}
	if isLoopbackHost(host) {
		return true
	}
	// ParseIP returns nil for anything that is not an address, which includes
	// every ordinary hostname. A name like `dev.local` is therefore deliberately
	// not accepted: knowing what it resolves to would need a DNS lookup, and
	// guessing is the wrong direction to guess in.
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
}

// sameLoopbackService reports whether two origins name the same loopback service:
// the same scheme, the same port, and both on a loopback host.
func sameLoopbackService(a, b string) bool {
	as, ah, ap, aok := splitOrigin(a)
	bs, bh, bp, bok := splitOrigin(b)
	if !aok || !bok || as != bs || ap != bp {
		return false
	}
	return isLoopbackHost(ah) && isLoopbackHost(bh)
}

func splitOrigin(origin string) (scheme, host, port string, ok bool) {
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" {
		return "", "", "", false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", "", "", false
	}
	// Hostname() strips the brackets from an IPv6 literal, so `[::1]` becomes
	// `::1` and the comparison sees one form rather than two.
	return strings.ToLower(u.Scheme), strings.ToLower(u.Hostname()), u.Port(), true
}

func isLoopbackHost(host string) bool {
	switch host {
	case "localhost", "127.0.0.1", "::1":
		return true
	}
	return false
}

// ErrCSRF is returned when a state-changing request fails origin or token checks.
var ErrCSRF = errConst("auth: csrf check failed")

type errConst string

func (e errConst) Error() string { return string(e) }
