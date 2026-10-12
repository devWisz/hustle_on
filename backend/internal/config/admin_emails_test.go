package config

import "testing"

// An operator account is reached by email as well as by wallet, and the email
// comparison has to fold case: nobody types their own address the same way twice,
// and refusing a correctly listed operator over capitalisation is the kind of fault
// that looks like the console being broken.
func TestAdminSourceFindsOperatorsByWalletAndEmail(t *testing.T) {
	c := Config{
		AdminWallets: []string{"6i5V4iC135Aej1UEDHC25BK1kZGvGgq8Zbjapt9JirPy"},
		AdminEmails:  []string{"Operator@Example.com"},
	}

	for _, tc := range []struct{ wallet, email, want string }{
		{"6i5V4iC135Aej1UEDHC25BK1kZGvGgq8Zbjapt9JirPy", "", "ADMIN_WALLETS"},
		{"", "operator@example.com", "ADMIN_EMAILS"},
		{"", "OPERATOR@EXAMPLE.COM", "ADMIN_EMAILS"},
		{"", " operator@example.com ", "ADMIN_EMAILS"},
		{"", "someone.else@example.com", ""},
		{"", "", ""},
		{"6i5V4iC135Aej1UEDHC25BK1kZGvGgq8Zbjapt9JirPy", "operator@example.com", "ADMIN_WALLETS"},
	} {
		if got := c.AdminSource(tc.wallet, tc.email); got != tc.want {
			t.Errorf("AdminSource(%q, %q) = %q, want %q", tc.wallet, tc.email, got, tc.want)
		}
	}
}

// A wallet address is base58 and therefore case-sensitive, so folding it would let
// two different addresses compare equal and hand the role to the wrong one.
func TestWalletAddressesStayCaseSensitive(t *testing.T) {
	c := Config{AdminWallets: []string{"6i5V4iC135Aej1UEDHC25BK1kZGvGgq8Zbjapt9JirPy"}}
	if c.IsAdminWallet("6i5v4ic135aej1uedhc25bk1kzgvggq8zbjapt9jirpy") {
		t.Error("a lowercased address was accepted as its mixed-case original")
	}
}

// An empty entry in the list must never match an account that has no email, or a
// trailing comma in ADMIN_EMAILS would make every wallet-only account an operator.
func TestEmptyEmailEntriesMatchNothing(t *testing.T) {
	c := Config{AdminEmails: []string{"", "  "}}
	if c.AdminSource("", "") != "" {
		t.Error("an account with no address was treated as an operator")
	}
	if c.AdminSource("6i5V4iC135Aej1UEDHC25BK1kZGvGgq8Zbjapt9JirPy", "") != "" {
		t.Error("a wallet-only account was treated as an operator by an empty email entry")
	}
}
