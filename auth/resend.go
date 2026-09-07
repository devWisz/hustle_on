package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// ResendMailer sends transactional email through the Resend API.
type ResendMailer struct {
	APIKey  string
	From    string
	ReplyTo string
	Client  *http.Client
}

// NewResendMailer returns a mailer with a bounded HTTP client. Email delivery
// must never be able to hold an API request open indefinitely.
func NewResendMailer(apiKey, from, replyTo string) *ResendMailer {
	return &ResendMailer{
		APIKey:  apiKey,
		From:    from,
		ReplyTo: replyTo,
		Client:  &http.Client{Timeout: 10 * time.Second},
	}
}

type resendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html,omitempty"`
	Text    string   `json:"text,omitempty"`
	ReplyTo string   `json:"reply_to,omitempty"`
	Tags    []struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	} `json:"tags,omitempty"`
}

// Send delivers one message. Errors are returned without the message body so
// that a failed send cannot spill a login link into the logs.
func (m *ResendMailer) Send(ctx context.Context, msg Message) error {
	payload := resendPayload{
		From:    m.From,
		To:      []string{msg.To},
		Subject: msg.Subject,
		HTML:    msg.HTML,
		Text:    msg.Text,
		ReplyTo: m.ReplyTo,
	}
	if msg.Tag != "" {
		payload.Tags = append(payload.Tags, struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		}{Name: "category", Value: msg.Tag})
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("auth: encode email: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("auth: build email request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+m.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.Client.Do(req)
	if err != nil {
		return fmt.Errorf("auth: send email: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("auth: resend returned %d: %s", resp.StatusCode, detail)
	}
	return nil
}

// LogMailer prints messages instead of sending them. Development only; it is
// selected explicitly by the backend when no Resend key is configured.
type LogMailer struct{ Out io.Writer }

func (m LogMailer) Send(_ context.Context, msg Message) error {
	fmt.Fprintf(m.Out, "\n--- email to %s ---\n%s\n\n%s\n---\n", msg.To, msg.Subject, msg.Text)
	return nil
}
