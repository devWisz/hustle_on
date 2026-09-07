package auth

import "testing"

func TestNormalizeEmail(t *testing.T) {
	cases := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{"Maya@Example.COM", "Maya@example.com", false},
		{"  dev@sardhana.com  ", "dev@sardhana.com", false},
		{"Maya Rao <maya@example.com>", "maya@example.com", false},
		{"not-an-email", "", true},
		{"", "", true},
		{"a@b.com\r\nbcc: victim@example.com", "", true},
	}
	for _, c := range cases {
		got, err := NormalizeEmail(c.in)
		if c.wantErr {
			if err == nil {
				t.Errorf("NormalizeEmail(%q) = %q, want error", c.in, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("NormalizeEmail(%q) unexpected error: %v", c.in, err)
		} else if got != c.want {
			t.Errorf("NormalizeEmail(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestSafeRedirectPath(t *testing.T) {
	allowed := []string{"/dashboard", "/creator/maya", "/upload?step=2"}
	for _, in := range allowed {
		if got := SafeRedirectPath(in); got != in {
			t.Errorf("SafeRedirectPath(%q) = %q, want it kept", in, got)
		}
	}
	// Anything that could leave the origin must be dropped.
	rejected := []string{
		"https://evil.example.com",
		"//evil.example.com",
		"/\\evil.example.com",
		"javascript:alert(1)",
		"/ok\r\nSet-Cookie: a=b",
		"",
	}
	for _, in := range rejected {
		if got := SafeRedirectPath(in); got != "" {
			t.Errorf("SafeRedirectPath(%q) = %q, want \"\"", in, got)
		}
	}
}

func TestSuggestHandle(t *testing.T) {
	cases := map[string]string{
		"maya.rao@example.com": "mayarao",
		"K@example.com":        "builderk",
		"dev+tag@example.com":  "devtag",
	}
	for in, want := range cases {
		if got := SuggestHandle(in); got != want {
			t.Errorf("SuggestHandle(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestTokenDigestIsStable(t *testing.T) {
	secret, digest, err := NewToken()
	if err != nil {
		t.Fatalf("NewToken: %v", err)
	}
	if !EqualDigest(digest, Digest(secret)) {
		t.Fatal("digest of the returned secret does not match the returned digest")
	}
	other, _, _ := NewToken()
	if EqualDigest(digest, Digest(other)) {
		t.Fatal("two tokens produced the same digest")
	}
}
