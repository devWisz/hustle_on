package media

import (
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"
)

func testStorage() *Storage {
	return New(Config{
		Endpoint:  "https://s3.us-east-1.amazonaws.com",
		Bucket:    "sardhana-media",
		Region:    "us-east-1",
		AccessKey: "AKIAEXAMPLE",
		SecretKey: "secret",
		PublicURL: "https://media.sardhana.com",
		MaxBytes:  1 << 30,
		URLTTL:    15 * time.Minute,
	})
}

func TestNewUploadSignsAScopedURL(t *testing.T) {
	s := testStorage()
	up, err := s.NewUpload("user-1", "video/mp4", 10<<20)
	if err != nil {
		t.Fatalf("NewUpload: %v", err)
	}
	if !strings.HasPrefix(up.Key, "uploads/user-1/") || !strings.HasSuffix(up.Key, ".mp4") {
		t.Fatalf("unexpected key %q", up.Key)
	}
	u, err := url.Parse(up.URL)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	for _, param := range []string{"X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Date", "X-Amz-Expires", "X-Amz-Signature"} {
		if u.Query().Get(param) == "" {
			t.Errorf("presigned URL is missing %s", param)
		}
	}
	if got := u.Query().Get("X-Amz-SignedHeaders"); got != "content-type;host" {
		t.Errorf("signed headers = %q, want content-type;host", got)
	}
}

func TestNewUploadRejectsUnsafeInput(t *testing.T) {
	s := testStorage()
	if _, err := s.NewUpload("user-1", "text/html", 1024); !errors.Is(err, ErrUnsupportedType) {
		t.Errorf("text/html accepted: %v", err)
	}
	if _, err := s.NewUpload("user-1", "image/svg+xml", 1024); !errors.Is(err, ErrUnsupportedType) {
		t.Errorf("svg accepted: %v", err)
	}
	if _, err := s.NewUpload("user-1", "video/mp4", 2<<30); !errors.Is(err, ErrTooLarge) {
		t.Errorf("oversized upload accepted: %v", err)
	}
	if _, err := s.NewUpload("user-1", "video/mp4", 0); !errors.Is(err, ErrTooLarge) {
		t.Errorf("zero-size upload accepted: %v", err)
	}
}

func TestOwnsKey(t *testing.T) {
	s := testStorage()
	if !s.OwnsKey("user-1", "uploads/user-1/2026/09/abc.mp4") {
		t.Error("owner rejected for their own key")
	}
	if s.OwnsKey("user-2", "uploads/user-1/2026/09/abc.mp4") {
		t.Error("a key under another user's prefix was accepted")
	}
}
