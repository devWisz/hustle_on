package validate

import "testing"

func TestHandleRules(t *testing.T) {
	for _, good := range []string{"maya", "kaito_mori", "dev01"} {
		if New().Handle("handle", good).Any() {
			t.Errorf("handle %q was rejected", good)
		}
	}
	// Reserved words would shadow real routes; mixed case and symbols would
	// make two visually distinct handles collide.
	for _, bad := range []string{"ab", "Maya", "admin", "settings", "with space", "a-b"} {
		if !New().Handle("handle", bad).Any() {
			t.Errorf("handle %q was accepted", bad)
		}
	}
}

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Write-ahead log, day 14":  "write-ahead-log-day-14",
		"  Checkout Flow Rebuild ": "checkout-flow-rebuild",
		"???":                      "",
	}
	for in, want := range cases {
		if got := Slugify(in); got != want {
			t.Errorf("Slugify(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCleanTextStripsControlCharacters(t *testing.T) {
	got := CleanText("  hello\x00\x07 world\n\n\n\nagain  ")
	if got != "hello world\n\nagain" {
		t.Fatalf("CleanText gave %q", got)
	}
}

func TestLengthCountsRunesNotBytes(t *testing.T) {
	// Six characters, eighteen bytes: measured as the writer would count them.
	if New().Length("title", "日本語日本語", 6, 6).Any() {
		t.Error("a six-character title was measured as the wrong length")
	}
}

func TestLinkFieldsArePinnedToTheirHosts(t *testing.T) {
	if New().GitHubURL("githubUrl", "https://github.com/maya/compiler").Any() {
		t.Error("a valid GitHub URL was rejected")
	}
	if New().XURL("xUrl", "https://x.com/maya").Any() {
		t.Error("a valid X URL was rejected")
	}
	// Both fields are optional, so an empty value must pass.
	if New().GitHubURL("githubUrl", "").Any() || New().XURL("xUrl", "").Any() {
		t.Error("an empty link was rejected")
	}
	// A link field is rendered on a public page, so anything that is not the
	// expected host — including a lookalike domain — has to be refused.
	for _, bad := range []string{
		"http://github.com/maya",
		"https://github.com.evil.test/maya",
		"https://evil.test/maya",
		"javascript:alert(1)",
		"//github.com/maya",
	} {
		if !New().GitHubURL("githubUrl", bad).Any() {
			t.Errorf("GitHub URL %q was accepted", bad)
		}
	}
	for _, bad := range []string{"https://x.com.evil.test/maya", "https://facebook.com/maya"} {
		if !New().XURL("xUrl", bad).Any() {
			t.Errorf("X URL %q was accepted", bad)
		}
	}
}
