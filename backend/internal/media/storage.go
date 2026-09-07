// Package media issues presigned upload URLs for object storage.
//
// The browser uploads directly to the bucket, so video bytes never pass
// through the API. What the API controls is the URL: it names the exact object
// key, caps the lifetime, and is signed with credentials the browser never
// sees. A client cannot widen that permission by editing the URL, because any
// change invalidates the signature.
package media

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Config describes the bucket and credentials.
type Config struct {
	Endpoint  string // https://s3.region.amazonaws.com
	Bucket    string
	Region    string
	AccessKey string
	SecretKey string
	PublicURL string // CDN or public base URL for reads
	MaxBytes  int64
	URLTTL    time.Duration
}

type Storage struct{ cfg Config }

func New(cfg Config) *Storage {
	if cfg.URLTTL == 0 {
		cfg.URLTTL = 15 * time.Minute
	}
	if cfg.MaxBytes == 0 {
		cfg.MaxBytes = 2 << 30
	}
	return &Storage{cfg: cfg}
}

// allowedContentTypes is a strict allowlist. Serving user uploads means the
// content type is a security control, not metadata: an HTML file accepted here
// and served from a bucket origin becomes stored cross-site scripting.
var allowedContentTypes = map[string]string{
	"video/mp4":        "mp4",
	"video/quicktime":  "mov",
	"video/webm":       "webm",
	"video/x-matroska": "mkv",
}

// ErrUnsupportedType is returned for a content type outside the allowlist.
var ErrUnsupportedType = errors.New("media: unsupported content type")

// ErrTooLarge is returned when the declared size exceeds the ceiling.
var ErrTooLarge = errors.New("media: file is too large")

// Upload is a signed destination for one object.
type Upload struct {
	URL       string    `json:"url"`
	Key       string    `json:"key"`
	ExpiresAt time.Time `json:"expiresAt"`
	MaxBytes  int64     `json:"maxBytes"`
}

// NewUpload validates the request and returns a presigned PUT URL.
// The key embeds the owner id, so an object can always be traced back to the
// account that requested it even if the database row is later removed.
func (s *Storage) NewUpload(userID, contentType string, declaredSize int64) (Upload, error) {
	ext, ok := allowedContentTypes[contentType]
	if !ok {
		return Upload{}, ErrUnsupportedType
	}
	if declaredSize <= 0 || declaredSize > s.cfg.MaxBytes {
		return Upload{}, ErrTooLarge
	}

	suffix := make([]byte, 8)
	if _, err := rand.Read(suffix); err != nil {
		return Upload{}, fmt.Errorf("media: entropy: %w", err)
	}
	now := time.Now().UTC()
	key := fmt.Sprintf("uploads/%s/%s/%s.%s",
		userID, now.Format("2006/01"), hex.EncodeToString(suffix), ext)

	signed, err := s.presignPut(key, contentType, now)
	if err != nil {
		return Upload{}, err
	}
	return Upload{
		URL:       signed,
		Key:       key,
		ExpiresAt: now.Add(s.cfg.URLTTL),
		MaxBytes:  s.cfg.MaxBytes,
	}, nil
}

// PublicURL returns the read URL for a stored object.
func (s *Storage) PublicURL(key string) string {
	if s.cfg.PublicURL == "" {
		return ""
	}
	return strings.TrimRight(s.cfg.PublicURL, "/") + "/" + key
}

// presignPut builds an AWS Signature Version 4 query-string signature.
func (s *Storage) presignPut(key, contentType string, now time.Time) (string, error) {
	endpoint, err := url.Parse(s.cfg.Endpoint)
	if err != nil {
		return "", fmt.Errorf("media: parse endpoint: %w", err)
	}
	host := endpoint.Host
	canonicalURI := "/" + s.cfg.Bucket + "/" + key

	stamp := now.Format("20060102T150405Z")
	datestamp := now.Format("20060102")
	scope := strings.Join([]string{datestamp, s.cfg.Region, "s3", "aws4_request"}, "/")

	q := url.Values{}
	q.Set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	q.Set("X-Amz-Credential", s.cfg.AccessKey+"/"+scope)
	q.Set("X-Amz-Date", stamp)
	q.Set("X-Amz-Expires", strconv.Itoa(int(s.cfg.URLTTL.Seconds())))
	// content-type is signed, so the uploaded object cannot be relabelled as
	// something the allowlist would have rejected.
	q.Set("X-Amz-SignedHeaders", "content-type;host")

	canonicalHeaders := "content-type:" + contentType + "\nhost:" + host + "\n"
	canonicalRequest := strings.Join([]string{
		"PUT",
		canonicalURI,
		encodeQuery(q),
		canonicalHeaders,
		"content-type;host",
		"UNSIGNED-PAYLOAD",
	}, "\n")

	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		stamp,
		scope,
		hex.EncodeToString(sha256sum([]byte(canonicalRequest))),
	}, "\n")

	signingKey := hmacSHA256(
		hmacSHA256(
			hmacSHA256(
				hmacSHA256([]byte("AWS4"+s.cfg.SecretKey), []byte(datestamp)),
				[]byte(s.cfg.Region)),
			[]byte("s3")),
		[]byte("aws4_request"))

	q.Set("X-Amz-Signature", hex.EncodeToString(hmacSHA256(signingKey, []byte(stringToSign))))

	return endpoint.Scheme + "://" + host + canonicalURI + "?" + encodeQuery(q), nil
}

// encodeQuery sorts and encodes parameters the way SigV4 requires.
func encodeQuery(q url.Values) string {
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		parts = append(parts, url.QueryEscape(k)+"="+url.QueryEscape(q.Get(k)))
	}
	return strings.Join(parts, "&")
}

func hmacSHA256(key, data []byte) []byte {
	m := hmac.New(sha256.New, key)
	m.Write(data)
	return m.Sum(nil)
}

func sha256sum(b []byte) []byte {
	sum := sha256.Sum256(b)
	return sum[:]
}

// OwnsKey reports whether a storage key was issued to this user. The API calls
// it before recording an upload, so a client cannot claim an object under
// somebody else's prefix.
func (s *Storage) OwnsKey(userID, key string) bool {
	return strings.HasPrefix(key, "uploads/"+userID+"/")
}
