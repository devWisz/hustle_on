package config

import "testing"

func TestCookieDomainMustCoverTheWebHost(t *testing.T) {
	base := validConfig()

	ok := base
	ok.WebURL, ok.CookieDomain = "https://hustleon.com", ".hustleon.com"
	if err := ok.validate(); err != nil {
		t.Fatalf("apex host under its own domain should pass: %v", err)
	}

	sub := base
	sub.WebURL, sub.CookieDomain = "https://www.hustleon.com", "hustleon.com"
	if err := sub.validate(); err != nil {
		t.Fatalf("subdomain should pass: %v", err)
	}

	bad := base
	bad.WebURL, bad.CookieDomain = "https://hustleon.com", ".evil.com"
	if err := bad.validate(); err == nil {
		t.Fatal("a foreign cookie domain must be refused")
	}

	lookalike := base
	lookalike.WebURL, lookalike.CookieDomain = "https://nothustleon.com", "hustleon.com"
	if err := lookalike.validate(); err == nil {
		t.Fatal("a lookalike host must not match by plain suffix")
	}
}
