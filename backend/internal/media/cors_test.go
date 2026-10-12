package media

import (
	"context"
	"strings"
	"testing"
)

// The rule has to name the origin the browser actually sends, which is a bare
// scheme and host with no path and no trailing slash. A value that kept its
// path would never match, and the upload would fail with no useful clue why.
func TestCleanOriginsReducesURLsToBareOrigins(t *testing.T) {
	got := cleanOrigins([]string{
		"https://hustleon.vercel.app/",
		"https://hustleon.vercel.app",
		"https://hustleon.vercel.app/upload/step-two",
		" http://localhost:3001 ",
		"https://example.com:8443/deep/path",
	})
	want := []string{
		"https://hustleon.vercel.app",
		"http://localhost:3001",
		"https://example.com:8443",
	}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("origin %d = %q, want %q", i, got[i], want[i])
		}
	}
}

// Anything that is not an http(s) origin is dropped rather than written into the
// bucket policy. A mistake here would be published to the storage provider.
func TestCleanOriginsDropsAnythingThatIsNotAnOrigin(t *testing.T) {
	got := cleanOrigins([]string{
		"",
		"   ",
		"not a url",
		"ftp://example.com",
		"javascript:alert(1)",
		"https://",
		"*/",
	})
	if len(got) != 0 {
		t.Fatalf("expected nothing, got %v", got)
	}
}

// Every configured origin belongs in one rule. Emitting a rule per origin would
// work too, but a provider that keeps only the last one would silently drop the
// others, which is exactly the failure this code exists to prevent.
func TestCORSXMLKeepsEveryOriginInOneRule(t *testing.T) {
	body := string(corsXML([]string{"https://a.example", "https://b.example"}))
	for _, origin := range []string{"https://a.example", "https://b.example"} {
		if !strings.Contains(body, "<AllowedOrigin>"+origin+"</AllowedOrigin>") {
			t.Errorf("missing origin %q in %s", origin, body)
		}
	}
	if n := strings.Count(body, "<CORSRule>"); n != 1 {
		t.Errorf("expected one rule, got %d", n)
	}
	// The browser sends the preflight as OPTIONS and the upload as PUT; a rule
	// without PUT matches the preflight and then fails the upload.
	for _, method := range []string{"PUT", "GET", "HEAD"} {
		if !strings.Contains(body, "<AllowedMethod>"+method+"</AllowedMethod>") {
			t.Errorf("missing method %s", method)
		}
	}
}

// Local storage is a directory on disk, so there is no bucket to configure and
// no request should be attempted.
func TestSetCORSIsANoOpWithoutRealStorage(t *testing.T) {
	s := New(Config{Endpoint: "http://localhost:9000", Bucket: "dev", AccessKey: "replace-me"})
	if err := s.SetCORS(context.Background(), []string{"https://hustleon.vercel.app"}); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}
