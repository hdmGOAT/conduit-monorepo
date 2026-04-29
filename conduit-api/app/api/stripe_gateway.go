package api

import (
	"context"
	"errors"
	"fmt"
	"strings"

	stripe "github.com/stripe/stripe-go/v84"
	"github.com/stripe/stripe-go/v84/webhook"
)

var errStripeNotConfigured = errors.New("stripe payments are not configured")

type stripeGateway interface {
	CreatePaymentIntent(ctx context.Context, amount int64, metadata map[string]string) (*stripePaymentIntent, error)
	ParseWebhookEvent(payload []byte, signature string) (stripeWebhookEvent, error)
}

type stripePaymentIntent struct {
	ID           string `json:"id"`
	ClientSecret string `json:"client_secret"`
}

type stripeWebhookEvent struct {
	Type            string `json:"type"`
	PaymentIntentID string `json:"payment_intent_id"`
}

type stripeClient struct {
	client        *stripe.Client
	webhookSecret string
	currency      string
}

func NewStripeGateway(secretKey, webhookSecret, currency string) stripeGateway {
	normalizedSecretKey := strings.TrimSpace(secretKey)
	normalizedWebhookSecret := strings.TrimSpace(webhookSecret)
	if normalizedSecretKey == "" || normalizedWebhookSecret == "" {
		return nil
	}

	normalizedCurrency := strings.ToLower(strings.TrimSpace(currency))
	if normalizedCurrency == "" {
		normalizedCurrency = string(stripe.CurrencyUSD)
	}

	return &stripeClient{
		client:        stripe.NewClient(normalizedSecretKey),
		webhookSecret: normalizedWebhookSecret,
		currency:      normalizedCurrency,
	}
}

func (s *stripeClient) CreatePaymentIntent(ctx context.Context, amount int64, metadata map[string]string) (*stripePaymentIntent, error) {
	if s == nil || s.client == nil {
		return nil, errStripeNotConfigured
	}

	params := &stripe.PaymentIntentCreateParams{
		Amount:             stripe.Int64(amount),
		Currency:           stripe.String(s.currency),
		PaymentMethodTypes: stripe.StringSlice([]string{"card"}),
		Metadata:           metadata,
	}

	intent, err := s.client.V1PaymentIntents.Create(ctx, params)
	if err != nil {
		return nil, err
	}
	if intent.ClientSecret == "" {
		return nil, fmt.Errorf("stripe payment intent client secret is empty")
	}

	return &stripePaymentIntent{
		ID:           intent.ID,
		ClientSecret: intent.ClientSecret,
	}, nil
}

func (s *stripeClient) ParseWebhookEvent(payload []byte, signature string) (stripeWebhookEvent, error) {
	if s == nil {
		return stripeWebhookEvent{}, errStripeNotConfigured
	}
	if s.webhookSecret == "" {
		return stripeWebhookEvent{}, errStripeNotConfigured
	}

	event, err := webhook.ConstructEventWithOptions(payload, signature, s.webhookSecret, webhook.ConstructEventOptions{IgnoreAPIVersionMismatch: true})
	if err != nil {
		return stripeWebhookEvent{}, err
	}

	result := stripeWebhookEvent{Type: string(event.Type)}
	switch event.Type {
	case stripe.EventTypePaymentIntentSucceeded, stripe.EventTypePaymentIntentPaymentFailed:
		result.PaymentIntentID = event.GetObjectValue("id")
	}

	return result, nil
}
