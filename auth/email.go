package auth

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	"html/template"
	"strings"
)

//go:embed templates/*.html
var templateFS embed.FS

// html/template escapes every interpolated value, so a hostile display name or
// address cannot inject markup into an email we send.
var emailTemplates = template.Must(template.ParseFS(templateFS, "templates/*.html"))

type loginEmailData struct {
	ProductName string
	LoginURL    string
	TTLMinutes  int
}

func (s *Service) sendLoginEmail(ctx context.Context, to, loginURL string) error {
	data := loginEmailData{
		ProductName: s.cfg.ProductName,
		LoginURL:    loginURL,
		TTLMinutes:  int(s.cfg.MagicLinkTTL.Minutes()),
	}
	var body bytes.Buffer
	if err := emailTemplates.ExecuteTemplate(&body, "magic_link.html", data); err != nil {
		return fmt.Errorf("auth: render login email: %w", err)
	}

	text := strings.Join([]string{
		"Sign in to " + data.ProductName,
		"",
		"Open this link to sign in:",
		loginURL,
		"",
		fmt.Sprintf("The link works once and expires in %d minutes.", data.TTLMinutes),
		"If you did not request it, ignore this email. Nothing has changed.",
	}, "\n")

	return s.mailer.Send(ctx, Message{
		To:      to,
		Subject: "Sign in to " + data.ProductName,
		HTML:    body.String(),
		Text:    text,
		Tag:     "login",
	})
}
