package media

import (
	"net/url"
	"strings"
	"testing"
)

func privateStorage() *Storage {
	return New(Config{
		Endpoint:  "https://br-x.storage.example.neon.tech",
		Bucket:    "recordings",
		Region:    "us-east-2",
		AccessKey: "nak_live_test",
		SecretKey: "nsk_live_test",
	})
}

func TestPrivateBucketStoresAReference(t *testing.T) {
	ref := privateStorage().PlaybackRef("uploads/u/2026/09/abc.mp4")
	if ref != "storage:uploads/u/2026/09/abc.mp4" {
		t.Fatalf("got %q", ref)
	}
}

func TestResolveSignsPrivateReferences(t *testing.T) {
	signed := privateStorage().Resolve("storage:uploads/u/2026/09/abc.mp4")
	u, err := url.Parse(signed)
	if err != nil {
		t.Fatal(err)
	}
	if u.Path != "/recordings/uploads/u/2026/09/abc.mp4" {
		t.Fatalf("path %q", u.Path)
	}
	q := u.Query()
	if q.Get("X-Amz-SignedHeaders") != "host" || q.Get("X-Amz-Signature") == "" || q.Get("X-Amz-Expires") != "7200" {
		t.Fatalf("unexpected query %v", q)
	}
}

func TestResolveLeavesPlainURLsAlone(t *testing.T) {
	s := privateStorage()
	for _, in := range []string{"/media/session-01.mp4", "https://cdn.example/x.mp4", ""} {
		if got := s.Resolve(in); got != in {
			t.Fatalf("%q became %q", in, got)
		}
	}
	if !strings.HasPrefix(s.Resolve("storage:k"), "https://") {
		t.Fatal("reference should become a signed https link")
	}
}
