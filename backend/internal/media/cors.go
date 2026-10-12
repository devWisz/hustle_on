package media

import (
	"bytes"
	"context"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
)

// SetCORS replaces the bucket's CORS rules with ones that allow uploads from
// these browser origins, and remembers them.
//
// A presigned PUT is not a simple request: it carries a method and a content
// type the browser must ask permission for first. If no bucket rule matches the
// page's origin the preflight is refused, the browser cancels the upload before
// a single byte is sent, and the client sees a transport error — which reads as
// "storage is unreachable" when storage is perfectly healthy.
//
// That rule used to be set by hand in the provider's console, and nobody updated
// it when the site moved to a new domain, so every upload from the new host
// failed. The API already holds credentials for the bucket, so it keeps the rule
// correct itself and a future move cannot break uploads again.
//
// Failure is returned rather than fatal: a key scoped to object access alone
// cannot change bucket configuration, and a deployment that cannot write the
// rule must still boot.
func (s *Storage) SetCORS(ctx context.Context, origins []string) error {
	origins = cleanOrigins(origins)
	if s.IsLocal() || len(origins) == 0 {
		return nil
	}
	s.rememberCORS(origins)
	return s.putCORS(ctx, s.knownCORS())
}

// EnsureCORSOrigin adds one browser origin to the bucket's rule, returning at
// once when it is already covered.
//
// The API cannot learn every origin it will be reached from out of its own
// configuration: a site can move domains without the API's environment being
// updated, which is exactly how uploads broke. The origin on the request that is
// about to be handed a presigned URL is, by definition, one the bucket has to
// accept — so it is taken from there rather than from a list someone maintains.
//
// Errors are swallowed. This runs on the path that issues an upload URL, and a
// bucket-configuration problem must not turn a working upload into a failed one.
func (s *Storage) EnsureCORSOrigin(ctx context.Context, origin string) {
	if s.IsLocal() || origin == "" {
		return
	}
	cleaned := cleanOrigins([]string{origin})
	if len(cleaned) == 0 {
		return
	}
	if !s.rememberCORS(cleaned) {
		return
	}
	if err := s.putCORS(ctx, s.knownCORS()); err != nil {
		// Forget it, so the next upload retries instead of assuming it worked.
		s.forgetCORS(cleaned[0])
	}
}

// rememberCORS records origins and reports whether anything new was added, so a
// caller only pays for a write when the rule actually changes.
func (s *Storage) rememberCORS(origins []string) bool {
	s.corsMu.Lock()
	defer s.corsMu.Unlock()
	if s.corsOrigins == nil {
		s.corsOrigins = make(map[string]bool, len(origins))
	}
	added := false
	for _, origin := range origins {
		if !s.corsOrigins[origin] {
			s.corsOrigins[origin] = true
			added = true
		}
	}
	return added
}

func (s *Storage) forgetCORS(origin string) {
	s.corsMu.Lock()
	defer s.corsMu.Unlock()
	delete(s.corsOrigins, origin)
}

// knownCORS returns the remembered origins in a stable order, so an unchanged
// set produces a byte-identical policy document.
func (s *Storage) knownCORS() []string {
	s.corsMu.Lock()
	defer s.corsMu.Unlock()
	out := make([]string, 0, len(s.corsOrigins))
	for origin := range s.corsOrigins {
		out = append(out, origin)
	}
	sort.Strings(out)
	return out
}

// putCORS writes the rule. The origins have already been reduced to bare origins
// by cleanOrigins, so they are safe to place in the XML body unescaped.
func (s *Storage) putCORS(ctx context.Context, origins []string) error {
	// The rule is shared: local development and the deployed API write to the
	// same bucket. Replacing it wholesale would make each one delete the other's
	// origins, which is exactly what happened the first time this ran, so what is
	// already there is read first and unioned with what is being added. Nothing
	// here ever removes an origin.
	origins = cleanOrigins(append(origins, s.currentCORS(ctx)...))
	if len(origins) == 0 {
		return nil
	}
	body := corsXML(origins)
	payloadHash := hex.EncodeToString(sha256sum(body))

	endpoint, err := url.Parse(s.cfg.Endpoint)
	if err != nil {
		return fmt.Errorf("media: parse endpoint: %w", err)
	}
	target := endpoint.Scheme + "://" + endpoint.Host + "/" + s.cfg.Bucket + "?cors"

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, target, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("media: build cors request: %w", err)
	}

	now := time.Now().UTC()
	stamp := now.Format("20060102T150405Z")
	datestamp := now.Format("20060102")
	scope := strings.Join([]string{datestamp, s.cfg.Region, "s3", "aws4_request"}, "/")

	req.Header.Set("Content-Type", "application/xml")
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	req.Header.Set("X-Amz-Date", stamp)
	req.Header.Set("Authorization", s.authorization(req, payloadHash, stamp, scope))

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("media: set bucket cors: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("media: set bucket cors: %s: %s", resp.Status, strings.TrimSpace(string(detail)))
	}
	return nil
}

// allowedOriginRE pulls the origins out of a CORS configuration document. A
// regular expression is used rather than a full XML decoder because the document
// is a flat list of simple elements and the API only ever reads it back to union
// it with its own.
var allowedOriginRE = regexp.MustCompile(`<AllowedOrigin>\s*([^<]+?)\s*</AllowedOrigin>`)

// currentCORS reads the origins already in the bucket's rule, returning nothing
// if the rule cannot be read. An unreadable rule is not fatal: the write that
// follows still succeeds, it simply does not preserve what was there.
func (s *Storage) currentCORS(ctx context.Context) []string {
	endpoint, err := url.Parse(s.cfg.Endpoint)
	if err != nil {
		return nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		endpoint.Scheme+"://"+endpoint.Host+"/"+s.cfg.Bucket+"?cors", nil)
	if err != nil {
		return nil
	}

	emptyHash := hex.EncodeToString(sha256sum(nil))
	now := time.Now().UTC()
	stamp := now.Format("20060102T150405Z")
	scope := strings.Join([]string{now.Format("20060102"), s.cfg.Region, "s3", "aws4_request"}, "/")
	req.Header.Set("X-Amz-Content-Sha256", emptyHash)
	req.Header.Set("X-Amz-Date", stamp)
	req.Header.Set("Authorization", s.authorization(req, emptyHash, stamp, scope))

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if err != nil {
		return nil
	}
	matches := allowedOriginRE.FindAllStringSubmatch(string(body), -1)
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		out = append(out, m[1])
	}
	return out
}

// authorization builds the SigV4 Authorization header for a request whose
// payload hash is known. It is the header-signing counterpart of presign's query
// signing, and the only place this package signs a request it also sends.
func (s *Storage) authorization(req *http.Request, payloadHash, stamp, scope string) string {
	const signedHeaders = "host;x-amz-content-sha256;x-amz-date"
	canonicalHeaders := "host:" + req.URL.Host + "\n" +
		"x-amz-content-sha256:" + payloadHash + "\n" +
		"x-amz-date:" + stamp + "\n"

	// S3 signs subresources with an empty value, so "?cors" is "cors=" here.
	canonicalRequest := strings.Join([]string{
		req.Method,
		req.URL.EscapedPath(),
		"cors=",
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	}, "\n")

	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		stamp,
		scope,
		hex.EncodeToString(sha256sum([]byte(canonicalRequest))),
	}, "\n")

	datestamp := strings.SplitN(scope, "/", 2)[0]
	signingKey := hmacSHA256(
		hmacSHA256(
			hmacSHA256(
				hmacSHA256([]byte("AWS4"+s.cfg.SecretKey), []byte(datestamp)),
				[]byte(s.cfg.Region)),
			[]byte("s3")),
		[]byte("aws4_request"))

	signature := hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign)))
	return "AWS4-HMAC-SHA256 Credential=" + s.cfg.AccessKey + "/" + scope +
		", SignedHeaders=" + signedHeaders + ", Signature=" + signature
}

// cleanOrigins reduces configured URLs to bare origins, dropping anything that
// is not http(s) and de-duplicating. Rebuilding each value from its parsed parts
// also guarantees the result holds only characters that are safe in the XML.
func cleanOrigins(origins []string) []string {
	seen := make(map[string]bool, len(origins))
	out := make([]string, 0, len(origins))
	for _, raw := range origins {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		u, err := url.Parse(raw)
		if err != nil || u.Host == "" {
			continue
		}
		if u.Scheme != "http" && u.Scheme != "https" {
			continue
		}
		origin := u.Scheme + "://" + u.Host
		if seen[origin] {
			continue
		}
		seen[origin] = true
		out = append(out, origin)
	}
	return out
}

// corsXML renders one rule covering every origin, so adding an origin cannot
// silently replace the others — the failure mode this whole file exists to stop.
func corsXML(origins []string) []byte {
	var b strings.Builder
	b.WriteString(`<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><CORSRule>`)
	for _, origin := range origins {
		b.WriteString("<AllowedOrigin>")
		b.WriteString(origin)
		b.WriteString("</AllowedOrigin>")
	}
	for _, method := range []string{"PUT", "GET", "HEAD"} {
		b.WriteString("<AllowedMethod>")
		b.WriteString(method)
		b.WriteString("</AllowedMethod>")
	}
	b.WriteString("<AllowedHeader>*</AllowedHeader>")
	b.WriteString("<ExposeHeader>ETag</ExposeHeader>")
	b.WriteString("<MaxAgeSeconds>3600</MaxAgeSeconds>")
	b.WriteString("</CORSRule></CORSConfiguration>")
	return []byte(b.String())
}
