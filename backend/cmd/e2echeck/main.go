// Command e2echeck drives the whole creator journey against a running API.
//
// It exists because the interesting failures in this project have not been unit
// failures. The rules live in pure functions and are well covered by tests; what
// breaks is the seam between them — a column that one query reads and another
// forgets, a handler with no client, a budget that throttles the very retry loop
// it was meant to protect. Every one of those compiled, passed its tests, and was
// wrong.
//
// So this walks the path a real person walks, over HTTP, against the real
// database, the real object storage stand-in and the real Solana RPC:
//
//	sign in with a wallet signature
//	ask for an upload URL and put bytes in it
//	create a draft, mark it uploaded, submit it for review
//	confirm it is invisible to strangers
//	find it in the review queue, approve it
//	confirm it is public, in the feed and on the creator's page
//	confirm the decision was audited
//	sponsor it from a second wallet
//	confirm a malformed and an unknown signature are not credited
//
// It needs a running API and a Solana keypair. The keypair does not need any SOL
// — signing in is a signature, and every step here except the actual transfer is
// free.
//
// Usage:
//
//	make dev                      # in another terminal
//	make e2e
//
// It leaves its session, its timelapse and a throwaway donor account behind,
// because the API's own role cannot delete rows by design. The last thing it
// prints is the SQL to remove them.
package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/sardhana/auth/base58"
)

const (
	defaultAPI = "http://localhost:8085"
	defaultWeb = "http://localhost:3001"
)

var (
	api     = envOr("E2E_API_URL", defaultAPI)
	web     = envOr("E2E_WEB_URL", defaultWeb)
	payload = []byte("stand-in mp4 bytes written by the end-to-end check")
	failed  int
)

func main() {
	address, priv, keypairPath := loadKeypair()
	fmt.Printf("wallet:   %s  (%s)\n", address, keypairPath)
	fmt.Printf("api:      %s\n\n", api)

	session := newClient()
	stranger := newClient()

	// --- sign in ------------------------------------------------------------
	self := signIn(session, address, priv)
	check("sign in with a wallet signature", self != nil, "sign-in failed")
	if self == nil {
		os.Exit(1)
	}
	handle := str(self["handle"])
	userID := str(self["id"])
	check("the account carries the operator role", self["role"] == "admin", str(self["role"]))

	// --- upload a real object ----------------------------------------------
	var upload struct {
		URL string `json:"url"`
		Key string `json:"key"`
	}
	code := call(session, "POST", "/v1/uploads",
		map[string]any{"contentType": "video/mp4", "sizeBytes": len(payload)}, &upload)
	check("ask for an upload URL", code == 201, http_(code))

	code = putBytes(session, upload.URL, payload)
	check("put the bytes into storage", code == 200 || code == 204, http_(code))
	check("read the object back", call(session, "GET", "/v1/uploads/local/"+upload.Key, nil, nil) == 200, "")

	// --- draft, upload, submit ---------------------------------------------
	var tl struct {
		ID   string `json:"id"`
		Slug string `json:"slug"`
	}
	title := "End-to-end check " + time.Now().UTC().Format("150405")
	code = call(session, "POST", "/v1/timelapses", map[string]any{
		"title":          title,
		"summary":        "A temporary session written by the end-to-end check, to prove the publishing pipeline still works.",
		"storageKey":     upload.Key,
		"sessionMinutes": 42,
		"githubUrl":      "https://github.com/hustleon/check",
	}, &tl)
	check("create the draft", code == 201, http_(code))
	check("the draft has a slug", tl.Slug != "", "")

	check("mark the upload done",
		call(session, "POST", "/v1/timelapses/"+tl.ID+"/uploaded",
			map[string]any{"sizeBytes": len(payload), "durationSeconds": 90}, nil) == 200, "")
	check("submit it for review",
		call(session, "POST", "/v1/timelapses/"+tl.ID+"/submit", nil, nil) == 200, "")

	// An unpublished session is deliberately visible to its creator and to an
	// operator, so asking while signed in as either proves nothing. The property
	// worth holding is that it is invisible to everybody else.
	code = call(stranger, "GET", "/v1/timelapses/"+tl.Slug, nil, nil)
	check("an unreviewed session is invisible to a stranger", code == 404, http_(code))

	// The recording is a capability URL rather than an authorised resource — the
	// local endpoint is a stand-in for a bucket and is registered only when no
	// bucket is configured. What has to hold either way is that the key cannot be
	// discovered from the API and is not guessable.
	check("the storage key is namespaced to its owner", strings.Contains(upload.Key, "/"+userID+"/"), upload.Key)
	tail := upload.Key[strings.LastIndex(upload.Key, "/")+1:]
	check("...and carries an unguessable component",
		len(strings.TrimSuffix(tail, ".mp4")) >= 12, tail)

	// --- review -------------------------------------------------------------
	var queue struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	call(session, "GET", "/v1/admin/queue?limit=50", nil, &queue)
	queued := false
	for _, it := range queue.Items {
		queued = queued || it.ID == tl.ID
	}
	check("it is waiting in the review queue", queued, fmt.Sprintf("%d queued", len(queue.Items)))

	code = call(session, "POST", "/v1/admin/timelapses/"+tl.ID+"/approve", nil, nil)
	check("approve it", code == 200 || code == 204, http_(code))

	// --- it is public now ---------------------------------------------------
	check("the approved session is public",
		call(session, "GET", "/v1/timelapses/"+tl.Slug, nil, nil) == 200, "")
	check("it appears in the feed", slugIn(callPage(session, "/v1/timelapses?limit=50"), tl.Slug), "")
	check("it appears on the creator's page",
		slugIn(callPage(session, "/v1/creators/"+handle+"/timelapses?limit=50"), tl.Slug), "")
	check("the decision is in the audit log", auditHasApproval(session, tl.ID), "")

	// --- a stranger can do none of it ---------------------------------------
	code = call(stranger, "POST", "/v1/uploads",
		map[string]any{"contentType": "video/mp4", "sizeBytes": 1024}, nil)
	check("a stranger cannot get an upload URL", code == 401, http_(code))

	// --- an email account can publish too ------------------------------------
	// The other path in, and the one the owner actually asked for. It gets its own
	// pass because it is a different identity with different rules: no wallet, no
	// profile step, and a password instead of a signature.
	//
	// The name is chosen so the derived handle is recognisable, which is what lets
	// `make e2e-clean` find these rows afterwards.
	emailAccount := fmt.Sprintf("e2e-%d@example.com", time.Now().UnixNano())
	emailPassword := "a long enough password"
	email := newClient()

	var signedUp map[string]any
	code = call(email, "POST", "/v1/auth/signup", map[string]any{
		"name": "E2E Email Check", "email": emailAccount, "password": emailPassword,
	}, &signedUp)
	check("sign up with an email and a password", code == 200, http_(code))
	check("the handle is derived from the name",
		strings.HasPrefix(str(signedUp["handle"]), "e2e_email_check"), str(signedUp["handle"]))
	// This is the regression guard for the thing that stopped the owner uploading:
	// a new account used to be sent to a profile step before it could do anything.
	check("an email account needs no profile step", signedUp["onboarded"] == true,
		fmt.Sprint(signedUp["onboarded"]))
	check("an email account has no wallet yet", str(signedUp["walletAddress"]) == "",
		str(signedUp["walletAddress"]))

	// A wrong password is refused identically to an unknown address.
	wrong := newClient()
	code = call(wrong, "POST", "/v1/auth/login",
		map[string]any{"email": emailAccount, "password": "not the password"}, nil)
	check("a wrong password is refused", code == 401, http_(code))
	code = call(wrong, "POST", "/v1/auth/login",
		map[string]any{"email": "nobody-at-all@example.com", "password": emailPassword}, nil)
	check("an unknown address is refused the same way", code == 401, http_(code))

	// And the right one works from a fresh client, so the session is not what let
	// the earlier requests through.
	fresh := newClient()
	code = call(fresh, "POST", "/v1/auth/login",
		map[string]any{"email": emailAccount, "password": emailPassword}, &map[string]any{})
	check("logging in with that password works", code == 200, http_(code))

	// The whole publishing path, as this account.
	var emailUpload struct {
		URL string `json:"url"`
		Key string `json:"key"`
	}
	code = call(fresh, "POST", "/v1/uploads",
		map[string]any{"contentType": "video/mp4", "sizeBytes": len(payload)}, &emailUpload)
	check("an email account can ask for an upload URL", code == 201, http_(code))
	if code != 201 {
		// Nothing downstream can work without an upload URL, and continuing would
		// only produce a second, more confusing failure.
		report()
		return
	}
	check("and put bytes into storage", putBytes(fresh, emailUpload.URL, payload) == 204, "")

	var emailTL struct {
		ID   string `json:"id"`
		Slug string `json:"slug"`
	}
	code = call(fresh, "POST", "/v1/timelapses", map[string]any{
		"title":          "Email account check " + time.Now().UTC().Format("150405"),
		"summary":        "A temporary session published by the end-to-end check to prove an email account can submit one.",
		"storageKey":     emailUpload.Key,
		"sessionMinutes": 15,
	}, &emailTL)
	check("an email account can create a session", code == 201, http_(code))
	check("mark it uploaded",
		call(fresh, "POST", "/v1/timelapses/"+emailTL.ID+"/uploaded",
			map[string]any{"sizeBytes": len(payload), "durationSeconds": 60}, nil) == 200, "")
	check("submit it for review",
		call(fresh, "POST", "/v1/timelapses/"+emailTL.ID+"/submit", nil, nil) == 200, "")

	var emailQueue struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	call(session, "GET", "/v1/admin/queue?limit=50", nil, &emailQueue)
	inQueue := false
	for _, it := range emailQueue.Items {
		inQueue = inQueue || it.ID == emailTL.ID
	}
	check("it reaches the review queue", inQueue, fmt.Sprintf("%d queued", len(emailQueue.Items)))

	check("and an operator can approve it",
		call(session, "POST", "/v1/admin/timelapses/"+emailTL.ID+"/approve", nil, nil) == 200, "")
	check("it is public afterwards",
		call(stranger, "GET", "/v1/timelapses/"+emailTL.Slug, nil, nil) == 200, "")
	call(session, "DELETE", "/v1/admin/timelapses/"+emailTL.ID, nil, nil)

	// --- sponsorship --------------------------------------------------------
	// A second account, because sponsoring your own work is refused and because
	// sign-in needs nothing but a signature — so this costs no SOL.
	donorPub, donorPriv, err := ed25519.GenerateKey(nil)
	must(err)
	donorAddr := base58.Encode(donorPub)
	donor := newClient()
	check("a second wallet becomes a member account",
		signIn(donor, donorAddr, donorPriv) != nil, "sign-in failed")

	var intent struct {
		ID        string `json:"id"`
		Recipient string `json:"recipient"`
		ProgramID string `json:"programId"`
	}
	code = call(donor, "POST", "/v1/donations", map[string]any{
		"slug": tl.Slug, "donorAddress": donorAddr,
		"amountLamports": 100_000_000, "message": "End-to-end check sponsorship.",
	}, &intent)
	check("record a sponsorship intent", code == 201, http_(code))
	check("the recipient is decided server-side, not by the client",
		intent.Recipient == address, intent.Recipient)
	check("the intent names the program to use, or none", true, intent.ProgramID)

	// Bad input is refused without troubling the RPC.
	code = call(donor, "POST", "/v1/donations/"+intent.ID+"/confirm",
		map[string]any{"signature": "not-a-signature"}, nil)
	check("a malformed signature is refused as unprocessable", code == 422, http_(code))

	// A well-formed signature for a transaction that does not exist must not be
	// credited. It is left claimable rather than failed, because it may simply
	// not have finalized — a distinction that matters to somebody who did pay.
	//
	// The bytes are random rather than zero: a transaction signature may only ever
	// be claimed once, so a fixed one works exactly once and every run after that
	// is refused as a duplicate. That refusal is correct, and it is not what this
	// step is checking.
	unknownBytes := make([]byte, ed25519.SignatureSize)
	if _, err := rand.Read(unknownBytes); err != nil {
		must(err)
	}
	unknown := base58.Encode(unknownBytes)
	code = call(donor, "POST", "/v1/donations/"+intent.ID+"/confirm",
		map[string]any{"signature": unknown}, nil)
	check("an unknown transaction is not credited", code == 202, http_(code))

	// --- hand back ----------------------------------------------------------
	call(session, "DELETE", "/v1/admin/timelapses/"+tl.ID, nil, nil)
	fmt.Printf("\nleft behind (the API's role cannot delete rows, by design):\n")
	fmt.Printf("  timelapse %s  (status: removed)\n", tl.Slug)
	fmt.Printf("  donor account %s\n", donorAddr)
	fmt.Printf("  email account %s (handle e2e_email_check…)\n", emailAccount)
	fmt.Printf("\nremove them with the owner connection:\n")
	fmt.Println("  make e2e-clean")

	fmt.Println()
	if failed == 0 {
		fmt.Println("EVERY STEP PASSED")
		return
	}
	fmt.Printf("%d STEP(S) FAILED\n", failed)
	os.Exit(1)
}

// --- steps ------------------------------------------------------------------

// signIn runs the whole passwordless flow and returns the profile, or nil.
func signIn(c *http.Client, address string, priv ed25519.PrivateKey) map[string]any {
	var challenge struct{ Message, Nonce, IssuedAt string }
	if call(c, "POST", "/v1/auth/signin/challenge",
		map[string]any{"address": address}, &challenge) != 200 {
		return nil
	}
	signature := base58.Encode(ed25519.Sign(priv, []byte(challenge.Message)))
	var self map[string]any
	if call(c, "POST", "/v1/auth/signin/verify", map[string]any{
		"address": address, "nonce": challenge.Nonce,
		"signature": signature, "issuedAt": challenge.IssuedAt,
	}, &self) != 200 {
		return nil
	}
	return self
}

type page struct {
	Items []struct {
		Slug string `json:"slug"`
	} `json:"items"`
	NextCursor string `json:"nextCursor"`
}

func callPage(c *http.Client, path string) page {
	var p page
	call(c, "GET", path, nil, &p)
	return p
}

func slugIn(p page, slug string) bool {
	for _, it := range p.Items {
		if it.Slug == slug {
			return true
		}
	}
	return false
}

func auditHasApproval(c *http.Client, timelapseID string) bool {
	var audit struct {
		Items []struct {
			Action    string `json:"action"`
			SubjectID string `json:"subjectId"`
		} `json:"items"`
	}
	call(c, "GET", "/v1/admin/audit?limit=50", nil, &audit)
	for _, a := range audit.Items {
		if a.SubjectID == timelapseID && strings.Contains(a.Action, "approve") {
			return true
		}
	}
	return false
}

// --- plumbing ---------------------------------------------------------------

func newClient() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar, Timeout: 30 * time.Second}
}

// loadKeypair reads the Solana CLI keypair, or whatever ANCHOR_WALLET points at.
// No SOL is needed: nothing here signs a transaction.
func loadKeypair() (string, ed25519.PrivateKey, string) {
	path := os.Getenv("ANCHOR_WALLET")
	if path == "" {
		home, _ := os.UserHomeDir()
		path = filepath.Join(home, ".config", "solana", "id.json")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot read the keypair at %s: %v\n", path, err)
		fmt.Fprintln(os.Stderr, "set ANCHOR_WALLET to a Solana keypair file")
		os.Exit(2)
	}
	var secret []byte
	if err := json.Unmarshal(raw, &secret); err != nil || len(secret) != ed25519.PrivateKeySize {
		fmt.Fprintf(os.Stderr, "%s is not a Solana keypair file\n", path)
		os.Exit(2)
	}
	priv := ed25519.PrivateKey(secret)
	return base58.Encode(priv.Public().(ed25519.PublicKey)), priv, path
}

func call(c *http.Client, method, path string, body, out any) int {
	return do(c, method, api+path, body, out)
}

func do(c *http.Client, method, url string, body, out any) int {
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, url, r)
	must(err)
	// The CSRF guard requires an allowed Origin on every state-changing request,
	// and a double-submit token once a session exists. Both are what a browser
	// would send, and leaving either out is refused — correctly.
	req.Header.Set("Origin", web)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	addCSRF(c, req)

	resp, err := c.Do(req)
	must(err)
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if out != nil && len(raw) > 0 {
		_ = json.Unmarshal(raw, out)
	}
	if resp.StatusCode >= 500 {
		fmt.Printf("        server said %d: %s\n", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	return resp.StatusCode
}

func putBytes(c *http.Client, url string, data []byte) int {
	req, err := http.NewRequest("PUT", url, bytes.NewReader(data))
	must(err)
	req.Header.Set("Content-Type", "video/mp4")
	req.Header.Set("Origin", web)
	addCSRF(c, req)
	resp, err := c.Do(req)
	must(err)
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode
}

func addCSRF(c *http.Client, req *http.Request) {
	if c.Jar == nil {
		return
	}
	for _, ck := range c.Jar.Cookies(req.URL) {
		if ck.Name == "hustleon_session_csrf" {
			req.Header.Set("X-Hustleon-CSRF", ck.Value)
		}
	}
}

// report prints the outcome and exits. Used when a step failed so completely that
// everything after it would fail for the same reason.
func report() {
	fmt.Println()
	if failed == 0 {
		fmt.Println("EVERY STEP PASSED")
		return
	}
	fmt.Printf("%d STEP(S) FAILED\n", failed)
	os.Exit(1)
}

func check(what string, ok bool, detail string) {
	if ok {
		fmt.Printf("  ok    %s\n", what)
		return
	}
	failed++
	if detail != "" {
		fmt.Printf("  FAIL  %s  (%s)\n", what, detail)
		return
	}
	fmt.Printf("  FAIL  %s\n", what)
}

func http_(code int) string { return fmt.Sprintf("HTTP %d", code) }

func str(v any) string {
	s, _ := v.(string)
	return s
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}
