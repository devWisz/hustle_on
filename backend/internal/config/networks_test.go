package config

import "testing"

func TestParseNetworks(t *testing.T) {
	got, err := parseNetworks(" 203.0.113.7, 10.0.0.0/8 ,")
	if err != nil || len(got) != 2 {
		t.Fatalf("got %v, %v", got, err)
	}
	if got[0].String() != "203.0.113.7/32" {
		t.Fatalf("single address should become a /32, got %s", got[0])
	}
	if _, err := parseNetworks("not-an-ip"); err == nil {
		t.Fatal("garbage must be refused")
	}
}
