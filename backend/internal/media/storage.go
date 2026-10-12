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
	"sync"
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
	// MaxBytes caps a video upload.
	MaxBytes int64
	// PosterMaxBytes caps a poster image, which has no reason to be as large as
	// a video and is downloaded by every visitor.
	PosterMaxBytes int64
	URLTTL         time.Duration
}

type Storage struct {
	cfg Config
	// corsMu guards corsOrigins, the set of browser origins the bucket's CORS
	// rule has been made to accept. It is read and written on the upload path.
	corsMu      sync.Mutex
	corsOrigins map[string]bool
}

func New(cfg Config) *Storage {
	if cfg.URLTTL == 0 {
		cfg.URLTTL = 15 * time.Minute
	}
	if cfg.MaxBytes == 0 {
		cfg.MaxBytes = 2 << 30
	}
	if cfg.PosterMaxBytes == 0 {
		cfg.PosterMaxBytes = 8 << 20
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

// allowedImageTypes is the allowlist for the images this API stores: posters and
// avatars. The omissions are the point — no SVG, because an SVG is a document
// that can carry script and these are served from the storage origin, and no GIF,
// because neither a thumbnail nor a profile picture is an animation.
var allowedImageTypes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/webp": "webp",
}

// Image namespaces, so a key answers "what is this" from the string alone and an
// object cannot be reassigned between the two kinds.
const (
	posterPrefix = "posters/"
	avatarPrefix = "avatars/"
)

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

// IsLocal reports whether object storage is simulated locally in development.
func (s *Storage) IsLocal() bool {
	return s.cfg.AccessKey == "" || s.cfg.AccessKey == "replace-me" || strings.Contains(s.cfg.Endpoint, "localhost") || strings.Contains(s.cfg.Endpoint, "127.0.0.1")
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

	if s.IsLocal() {
		return Upload{
			URL:       fmt.Sprintf("%s/v1/uploads/local/%s", strings.TrimRight(s.cfg.Endpoint, "/"), key),
			Key:       key,
			ExpiresAt: now.Add(s.cfg.URLTTL),
			MaxBytes:  s.cfg.MaxBytes,
		}, nil
	}

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

// NewPosterUpload is NewUpload for a poster image: the picture on a session's
// card.
func (s *Storage) NewPosterUpload(userID, contentType string, declaredSize int64) (Upload, error) {
	return s.newImageUpload(posterPrefix, userID, contentType, declaredSize)
}

// NewAvatarUpload is NewUpload for a profile picture.
//
// It is a separate method from NewPosterUpload even though the rules are
// identical today, because the two are attached to different things by different
// people: a poster belongs to a session an operator curates, an avatar belongs to
// an account its holder owns. Sharing one entry point would make it easy to
// loosen one and silently loosen the other.
func (s *Storage) NewAvatarUpload(userID, contentType string, declaredSize int64) (Upload, error) {
	return s.newImageUpload(avatarPrefix, userID, contentType, declaredSize)
}

// newImageUpload issues a presigned PUT for an image under one namespace.
//
// The type allowlist and the size ceiling are the image ones, never the video
// ones, which is why this is not a flag on NewUpload: a boolean would let a
// caller pick the video rules for an image.
func (s *Storage) newImageUpload(prefix, userID, contentType string, declaredSize int64) (Upload, error) {
	ext, ok := allowedImageTypes[contentType]
	if !ok {
		return Upload{}, ErrUnsupportedType
	}
	if declaredSize <= 0 || declaredSize > s.cfg.PosterMaxBytes {
		return Upload{}, ErrTooLarge
	}

	suffix := make([]byte, 8)
	if _, err := rand.Read(suffix); err != nil {
		return Upload{}, fmt.Errorf("media: entropy: %w", err)
	}
	now := time.Now().UTC()
	key := fmt.Sprintf("%s%s/%s/%s.%s",
		prefix, userID, now.Format("2006/01"), hex.EncodeToString(suffix), ext)

	if s.IsLocal() {
		return Upload{
			URL:       fmt.Sprintf("%s/v1/uploads/local/%s", strings.TrimRight(s.cfg.Endpoint, "/"), key),
			Key:       key,
			ExpiresAt: now.Add(s.cfg.URLTTL),
			MaxBytes:  s.cfg.PosterMaxBytes,
		}, nil
	}

	signed, err := s.presignPut(key, contentType, now)
	if err != nil {
		return Upload{}, err
	}
	return Upload{
		URL:       signed,
		Key:       key,
		ExpiresAt: now.Add(s.cfg.URLTTL),
		MaxBytes:  s.cfg.PosterMaxBytes,
	}, nil
}

// IsPosterKey reports whether a key is a poster object this API would have issued.
func (s *Storage) IsPosterKey(key string) bool { return isImageKey(key, posterPrefix) }

// IsAvatarKey reports whether a key is a profile picture this API would have
// issued.
func (s *Storage) IsAvatarKey(key string) bool { return isImageKey(key, avatarPrefix) }

// isImageKey is the check both of the above share.
//
// The traversal condition is not decoration. A key that merely starts with the
// prefix can still contain a traversal segment —
// "posters/<id>/../uploads/<id>/clip.mp4" passes a prefix test — and while the
// storage layers on both sides clean the path before touching a file, accepting
// such a key would mean recording a reference that means one thing to us and
// another to whatever serves it next. A key we did not issue is refused here.
func isImageKey(key, prefix string) bool {
	return strings.HasPrefix(key, prefix) &&
		!strings.Contains(key, "..") &&
		!strings.HasPrefix(key, "/")
}

// PublicURL returns the read URL for a stored object.
func (s *Storage) PublicURL(key string) string {
	if s.IsLocal() {
		return fmt.Sprintf("%s/v1/uploads/local/%s", strings.TrimRight(s.cfg.Endpoint, "/"), key)
	}
	if s.cfg.PublicURL == "" {
		return ""
	}
	return strings.TrimRight(s.cfg.PublicURL, "/") + "/" + key
}

// presignPut builds an AWS Signature Version 4 query-string signature.
func (s *Storage) presignPut(key, contentType string, now time.Time) (string, error) {
	return s.presign("PUT", key, contentType, s.cfg.URLTTL, now)
}

// presign builds a SigV4 query-signed URL. A PUT also signs the content type,
// so the browser can only upload the kind of file the API agreed to.
func (s *Storage) presign(method, key, contentType string, ttl time.Duration, now time.Time) (string, error) {
	endpoint, err := url.Parse(s.cfg.Endpoint)
	if err != nil {
		return "", fmt.Errorf("media: parse endpoint: %w", err)
	}
	host := endpoint.Host
	canonicalURI := "/" + s.cfg.Bucket + "/" + key

	stamp := now.Format("20060102T150405Z")
	datestamp := now.Format("20060102")
	scope := strings.Join([]string{datestamp, s.cfg.Region, "s3", "aws4_request"}, "/")

	signedHeaders := "host"
	canonicalHeaders := "host:" + host + "\n"
	if contentType != "" {
		signedHeaders = "content-type;host"
		canonicalHeaders = "content-type:" + contentType + "\n" + canonicalHeaders
	}

	q := url.Values{}
	q.Set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	q.Set("X-Amz-Credential", s.cfg.AccessKey+"/"+scope)
	q.Set("X-Amz-Date", stamp)
	q.Set("X-Amz-Expires", strconv.Itoa(int(ttl.Seconds())))
	q.Set("X-Amz-SignedHeaders", signedHeaders)

	canonicalRequest := strings.Join([]string{
		method,
		canonicalURI,
		encodeQuery(q),
		canonicalHeaders,
		signedHeaders,
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

// storagePrefix marks a stored reference to a private object. It is resolved to
// a short-lived signed link each time it leaves the API.
const storagePrefix = "storage:"

// playbackTTL is how long a signed playback link works.
const playbackTTL = 2 * time.Hour

// PlaybackRef is what gets stored for an uploaded object: a public URL when the
// bucket is served publicly or locally, otherwise a private reference.
func (s *Storage) PlaybackRef(key string) string {
	if s.IsLocal() || s.cfg.PublicURL != "" {
		return s.PublicURL(key)
	}
	return storagePrefix + key
}

// Resolve turns a stored reference into something a browser can load. Plain
// URLs pass through unchanged; private references become signed GET links.
func (s *Storage) Resolve(ref string) string {
	key, ok := strings.CutPrefix(ref, storagePrefix)
	if !ok || key == "" || s.IsLocal() {
		return ref
	}
	signed, err := s.presign("GET", key, "", playbackTTL, time.Now().UTC())
	if err != nil {
		return ""
	}
	return signed
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
	return strings.HasPrefix(key, "uploads/"+userID+"/") ||
		strings.HasPrefix(key, posterPrefix+userID+"/") ||
		strings.HasPrefix(key, avatarPrefix+userID+"/")
}
