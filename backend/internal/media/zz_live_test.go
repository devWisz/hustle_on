package media

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"testing"
	"time"
)

func TestLiveNeonStorage(t *testing.T) {
	path := os.Getenv("LIVE_STORAGE_FILE")
	if path == "" {
		t.Skip("set LIVE_STORAGE_FILE")
	}
	var c map[string]string
	raw, _ := os.ReadFile(path)
	_ = json.Unmarshal(raw, &c)
	s := New(Config{Endpoint: c["STORAGE_ENDPOINT"], Bucket: c["STORAGE_BUCKET"], Region: c["STORAGE_REGION"], AccessKey: c["STORAGE_ACCESS_KEY_ID"], SecretKey: c["STORAGE_SECRET_ACCESS_KEY"], MaxBytes: 1 << 20})
	up, err := s.NewUpload("live-check", "video/mp4", 5)
	if err != nil {
		t.Fatal(err)
	}
	req, _ := http.NewRequest("PUT", up.URL, bytes.NewReader([]byte("hello")))
	req.Header.Set("Content-Type", "video/mp4")
	res, err := http.DefaultClient.Do(req)
	if err != nil || res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("signed PUT failed: %v %d %s", err, res.StatusCode, b)
	}
	signed := s.Resolve(s.PlaybackRef(up.Key))
	got, err := http.Get(signed)
	if err != nil || got.StatusCode != 200 {
		t.Fatalf("signed GET failed: %v %d", err, got.StatusCode)
	}
	body, _ := io.ReadAll(got.Body)
	if string(body) != "hello" {
		t.Fatalf("body %q", body)
	}
	unsigned, _ := http.Get(c["STORAGE_ENDPOINT"] + "/" + c["STORAGE_BUCKET"] + "/" + up.Key)
	t.Logf("signed PUT ok, signed GET ok, unsigned GET status %d", unsigned.StatusCode)
	if unsigned.StatusCode == 200 {
		t.Fatal("private object readable without a signature")
	}
	del, _ := s.presign("DELETE", up.Key, "", time.Minute, time.Now().UTC())
	dreq, _ := http.NewRequest("DELETE", del, nil)
	if r, err := http.DefaultClient.Do(dreq); err == nil {
		t.Logf("cleanup delete status %d", r.StatusCode)
	}
}
