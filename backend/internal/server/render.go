package server

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/sardhana/backend/internal/logging"
	"github.com/sardhana/backend/internal/store"
	"github.com/sardhana/backend/pkg/apierr"
)

// maxBodyBytes caps every JSON request body. Uploads do not pass through the
// API, so no legitimate request is anywhere near this size.
const maxBodyBytes = 1 << 20 // 1 MiB

// handler is the signature every route uses. Returning an error rather than
// writing one keeps error rendering in exactly one place.
type handler func(http.ResponseWriter, *http.Request) error

func writeJSON(w http.ResponseWriter, status int, body any) error {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	if body == nil {
		return nil
	}
	return json.NewEncoder(w).Encode(body)
}

func noContent(w http.ResponseWriter) error {
	w.WriteHeader(http.StatusNoContent)
	return nil
}

type errorBody struct {
	Error struct {
		Code    string            `json:"code"`
		Message string            `json:"message"`
		Fields  map[string]string `json:"fields,omitempty"`
	} `json:"error"`
	RequestID string `json:"requestId,omitempty"`
}

// writeError renders an error for the client and logs the internal cause.
// The two are deliberately different: clients get a stable code and a safe
// message, the log gets the underlying failure.
func (s *Server) writeError(w http.ResponseWriter, r *http.Request, err error) {
	e := apierr.From(err)

	if e.Status >= 500 {
		s.log.ErrorContext(r.Context(), "request failed",
			slog.String("path", r.URL.Path),
			slog.String("method", r.Method),
			slog.String("request_id", logging.RequestID(r.Context())),
			slog.Any("error", err))
	} else {
		s.log.DebugContext(r.Context(), "request rejected",
			slog.String("path", r.URL.Path),
			slog.Int("status", e.Status),
			slog.String("code", e.Code))
	}

	var body errorBody
	body.Error.Code = e.Code
	body.Error.Message = e.Message
	body.Error.Fields = e.Fields
	body.RequestID = logging.RequestID(r.Context())
	_ = writeJSON(w, e.Status, body)
}

// decode reads a JSON body into dst with a size cap and strict field checking.
// Rejecting unknown fields turns a typo or a stale client into a clear 400
// instead of a silently ignored value.
func decode(r *http.Request, dst any) error {
	if ct := r.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/json") {
		return apierr.BadRequest("Send this request as application/json.")
	}
	limited := http.MaxBytesReader(nil, r.Body, maxBodyBytes)
	dec := json.NewDecoder(limited)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return apierr.PayloadTooLarge("Request body is too large.")
		}
		// DisallowUnknownFields reports through the same error path as a syntax
		// error. Saying which field was not recognised turns a stale client or
		// a typo into a fixable message instead of a puzzle.
		if field, ok := strings.CutPrefix(err.Error(), "json: unknown field "); ok {
			return apierr.BadRequest("Unrecognised field " + field + " in the request body.")
		}
		return apierr.BadRequest("Request body is not valid JSON.")
	}
	// A second value in the stream means the client sent something unexpected.
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		return apierr.BadRequest("Request body must contain a single JSON object.")
	}
	return nil
}

// storeErr converts a store error into an HTTP-shaped one.
func storeErr(err error, what string) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, store.ErrNotFound):
		return apierr.NotFound(what)
	case errors.Is(err, store.ErrConflict):
		return apierr.Conflict("That already exists.")
	default:
		return apierr.Internal(err)
	}
}

// queryInt reads a bounded integer query parameter.
func queryInt(r *http.Request, name string, fallback, min, max int) int {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	if n < min {
		return min
	}
	if n > max {
		return max
	}
	return n
}

// queryString reads a length-capped string query parameter.
func queryString(r *http.Request, name string, maxLen int) string {
	v := strings.TrimSpace(r.URL.Query().Get(name))
	if len(v) > maxLen {
		return v[:maxLen]
	}
	return v
}

// pageQuery reads the paging parameters every list endpoint accepts.
//
// It exists so the parameter names, the default and the cap are decided here
// rather than repeated per endpoint — an endpoint that forgot the cap would let
// one request ask for the whole table.
func pageQuery(r *http.Request, fallback, max int) store.PageQuery {
	return store.PageQuery{
		Cursor: queryString(r, "cursor", 200),
		Limit:  queryInt(r, "limit", fallback, 1, max),
	}
}

// listErr converts a list query's error into an HTTP one. A cursor is
// client-supplied, so one that is not ours is a bad request rather than a 404 or
// a quiet restart from the first page.
func listErr(err error, what string) error {
	if errors.Is(err, store.ErrBadCursor) {
		return apierr.BadRequest("That page cursor is not valid.")
	}
	return storeErr(err, what)
}

