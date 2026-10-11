// Package apierr defines the single error type the HTTP layer knows how to
// render. Handlers return one of these; the router turns it into a response.
//
// The split between Message and the wrapped error matters: Message is written
// to the client, the wrapped error goes to the log. Internal detail — driver
// errors, query text, file paths — must never travel outward.
package apierr

import (
	"errors"
	"fmt"
	"net/http"
)

// Error is an HTTP-shaped application error.
type Error struct {
	Status  int               // HTTP status code
	Code    string            // stable machine-readable code for clients
	Message string            // safe, human-readable text for the client
	Fields  map[string]string // per-field validation messages
	err     error             // internal cause, logged and never sent
}

func (e *Error) Error() string {
	if e.err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.err)
	}
	return e.Message
}

func (e *Error) Unwrap() error { return e.err }

// WithField adds a field-level validation message.
func (e *Error) WithField(name, message string) *Error {
	if e.Fields == nil {
		e.Fields = map[string]string{}
	}
	e.Fields[name] = message
	return e
}

func New(status int, code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

func BadRequest(message string) *Error {
	return New(http.StatusBadRequest, "bad_request", message)
}

func Validation(message string) *Error {
	return New(http.StatusUnprocessableEntity, "validation_failed", message)
}

func Unauthorized(message string) *Error {
	if message == "" {
		message = "Sign in to continue."
	}
	return New(http.StatusUnauthorized, "unauthorized", message)
}

func Forbidden(message string) *Error {
	if message == "" {
		message = "You do not have access to this."
	}
	return New(http.StatusForbidden, "forbidden", message)
}

func NotFound(what string) *Error {
	return New(http.StatusNotFound, "not_found", what+" was not found.")
}

func Conflict(message string) *Error {
	return New(http.StatusConflict, "conflict", message)
}

func TooManyRequests(message string) *Error {
	if message == "" {
		message = "Too many requests. Wait a moment and try again."
	}
	return New(http.StatusTooManyRequests, "rate_limited", message)
}

func PayloadTooLarge(message string) *Error {
	return New(http.StatusRequestEntityTooLarge, "payload_too_large", message)
}

// Internal wraps an unexpected failure. The client only ever sees the generic
// message; the cause is logged with the request id.
func Internal(err error) *Error {
	return &Error{
		Status:  http.StatusInternalServerError,
		Code:    "internal_error",
		Message: "Something went wrong on our side.",
		err:     err,
	}
}

// From normalises any error into an *Error.
func From(err error) *Error {
	if err == nil {
		return nil
	}
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	return Internal(err)
}

// WithCode returns a copy of the error with a more specific machine-readable
// code, so a client can react to one kind of refusal differently.
func (e *Error) WithCode(code string) *Error {
	out := *e
	out.Code = code
	return &out
}
