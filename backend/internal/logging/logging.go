// Package logging configures structured logging for the API.
package logging

import (
	"context"
	"log/slog"
	"os"
	"strings"
)

type ctxKey int

const requestIDKey ctxKey = iota

// New returns a JSON logger in production and a readable text logger locally.
func New(level, env string) *slog.Logger {
	opts := &slog.HandlerOptions{Level: parseLevel(level)}
	var h slog.Handler
	if env == "production" || env == "staging" {
		h = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		h = slog.NewTextHandler(os.Stdout, opts)
	}
	return slog.New(h)
}

func parseLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// WithRequestID stores a request id on the context.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey, id)
}

// RequestID reads the request id back, returning "" when absent.
func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey).(string)
	return id
}
