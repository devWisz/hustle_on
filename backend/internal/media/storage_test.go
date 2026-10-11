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

// --- poster images --------------------------------------------------------

func TestPosterTypesAreASeparateAllowlist(t *testing.T) {
	s := testStorage()

	for _, ct := range []string{"image/jpeg", "image/png", "image/webp"} {
		if _, err := s.NewPosterUpload("user-1", ct, 1024); err != nil {
			t.Errorf("poster type %s was rejected: %v", ct, err)
		}
	}

	// SVG is the one that matters: it is a document that can carry script, and
	// this object is served from the storage origin. GIF is out because a
	// thumbnail is a single frame. A video is out because a poster is not one.
	for _, ct := range []string{"image/svg+xml", "image/gif", "video/mp4", "text/html", ""} {
		if _, err := s.NewPosterUpload("user-1", ct, 1024); !errors.Is(err, ErrUnsupportedType) {
			t.Errorf("poster type %q was accepted", ct)
		}
	}
}

func TestPosterSizeCeilingIsItsOwn(t *testing.T) {
	s := testStorage()
	s.cfg.PosterMaxBytes = 2 << 20

	for _, size := range []int64{0, -1, (2 << 20) + 1} {
		if _, err := s.NewPosterUpload("user-1", "image/jpeg", size); !errors.Is(err, ErrTooLarge) {
			t.Errorf("poster size %d was accepted", size)
		}
	}
	if _, err := s.NewPosterUpload("user-1", "image/jpeg", 2<<20); err != nil {
		t.Errorf("a poster exactly at the ceiling was rejected: %v", err)
	}
	// The video ceiling is untouched by the poster one.
	if _, err := s.NewUpload("user-1", "video/mp4", 4<<20); err != nil {
		t.Errorf("a video within its own ceiling was rejected: %v", err)
	}
}

func TestPosterKeysAreNamespacedAndOwned(t *testing.T) {
	s := testStorage()
	up, err := s.NewPosterUpload("user-1", "image/png", 1024)
	if err != nil {
		t.Fatalf("poster upload: %v", err)
	}
	if !strings.HasPrefix(up.Key, "posters/user-1/") {
		t.Errorf("poster key %q is not namespaced under the owner", up.Key)
	}
	if !strings.HasSuffix(up.Key, ".png") {
		t.Errorf("poster key %q does not carry the image extension", up.Key)
	}
	if !s.IsPosterKey(up.Key) {
		t.Error("a poster key was not recognised as one")
	}
	if !s.OwnsKey("user-1", up.Key) {
		t.Error("the uploader does not own their own poster")
	}
	if s.OwnsKey("user-2", up.Key) {
		t.Error("a poster was claimable by another account")
	}

	// The two kinds do not cross: a video key is never a poster, and a poster is
	// not a video the API would accept as a recording.
	video, err := s.NewUpload("user-1", "video/mp4", 1024)
	if err != nil {
		t.Fatalf("video upload: %v", err)
	}
	if s.IsPosterKey(video.Key) {
		t.Error("a video key was treated as a poster")
	}
}

func TestPosterUploadIsServedLocally(t *testing.T) {
	s := New(Config{Endpoint: "http://localhost:8085", Bucket: "b", MaxBytes: 1 << 20})
	up, err := s.NewPosterUpload("user-1", "image/webp", 1024)
	if err != nil {
		t.Fatalf("poster upload: %v", err)
	}
	if !strings.HasPrefix(up.URL, "http://localhost:8085/v1/uploads/local/posters/user-1/") {
		t.Errorf("local poster URL = %q", up.URL)
	}
	if up.MaxBytes != 8<<20 {
		t.Errorf("local poster ceiling = %d, want the default 8 MiB", up.MaxBytes)
	}
}
