package email

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"strings"
	"time"
)

const defaultResendEndpoint = "https://api.resend.com/emails"

type ResendSender struct {
	apiKey   string
	from     string
	endpoint string
	client   *http.Client
}

type resendEmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

func NewResendSender(apiKey, from string) *ResendSender {
	return &ResendSender{
		apiKey:   strings.TrimSpace(apiKey),
		from:     strings.TrimSpace(from),
		endpoint: defaultResendEndpoint,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s *ResendSender) SendPasswordResetEmail(ctx context.Context, to, displayName, resetLink string) error {
	if strings.TrimSpace(s.apiKey) == "" || strings.TrimSpace(s.from) == "" {
		return errors.New("resend sender is not configured")
	}
	if strings.TrimSpace(to) == "" {
		return errors.New("missing destination email")
	}
	if strings.TrimSpace(resetLink) == "" {
		return errors.New("missing reset link")
	}

	name := strings.TrimSpace(displayName)
	if name == "" {
		name = "there"
	}

	escapedName := html.EscapeString(name)
	escapedLink := html.EscapeString(resetLink)
	payload := resendEmailRequest{
		From:    s.from,
		To:      []string{to},
		Subject: "Reset your Conduit password",
		HTML:    fmt.Sprintf("<p>Hi %s,</p><p>We received a request to reset your password.</p><p><a href=\"%s\">Reset password</a></p><p>If you did not request this, you can safely ignore this email.</p>", escapedName, escapedLink),
		Text:    fmt.Sprintf("Hi %s,\n\nWe received a request to reset your password.\n\nReset it here: %s\n\nIf you did not request this, you can safely ignore this email.", name, resetLink),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	msg := strings.TrimSpace(string(respBody))
	if msg == "" {
		msg = resp.Status
	}

	return fmt.Errorf("resend request failed: %s", msg)
}
