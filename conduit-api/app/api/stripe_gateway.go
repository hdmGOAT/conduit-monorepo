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
	CreateCheckoutSession(ctx context.Context, priceID, successURL, cancelURL, clientReferenceID string, metadata map[string]string) (*stripeCheckoutSession, error)
	RetrieveCheckoutSession(ctx context.Context, sessionID string) (*stripeCheckoutSession, error)
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

type stripeCheckoutSession struct {
	ID                string            `json:"id"`
	URL               string            `json:"url"`
	Status            string            `json:"status"`
	PaymentStatus     string            `json:"payment_status"`
	ClientReferenceID string            `json:"client_reference_id"`
	Metadata          map[string]string `json:"metadata"`
}

type stripeClient struct {
	client        *stripe.Client
	webhookSecret string
	currency      string
}

func NewStripeGateway(secretKey, webhookSecret, currency string) stripeGateway {
	normalizedSecretKey := strings.TrimSpace(secretKey)
	if normalizedSecretKey == "" {
		return nil
	}

	normalizedWebhookSecret := strings.TrimSpace(webhookSecret)

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

func (s *stripeClient) CreateCheckoutSession(ctx context.Context, priceID, successURL, cancelURL, clientReferenceID string, metadata map[string]string) (*stripeCheckoutSession, error) {
	if s == nil || s.client == nil {
		return nil, errStripeNotConfigured
	}

	params := &stripe.CheckoutSessionCreateParams{
		SuccessURL:        stripe.String(successURL),
		CancelURL:         stripe.String(cancelURL),
		ClientReferenceID: stripe.String(clientReferenceID),
		Mode:              stripe.String(stripe.CheckoutSessionModeSubscription),
		LineItems: []*stripe.CheckoutSessionCreateLineItemParams{
			{
				Price:    stripe.String(priceID),
				Quantity: stripe.Int64(1),
			},
		},
		Metadata: metadata,
	}

	session, err := s.client.V1CheckoutSessions.Create(ctx, params)
	if err != nil {
		return nil, err
	}

	return &stripeCheckoutSession{
		ID:                session.ID,
		URL:               session.URL,
		Status:            string(session.Status),
		PaymentStatus:     string(session.PaymentStatus),
		ClientReferenceID: session.ClientReferenceID,
		Metadata:          session.Metadata,
	}, nil
}

func (s *stripeClient) RetrieveCheckoutSession(ctx context.Context, sessionID string) (*stripeCheckoutSession, error) {
	if s == nil || s.client == nil {
		return nil, errStripeNotConfigured
	}

	session, err := s.client.V1CheckoutSessions.Retrieve(ctx, sessionID, &stripe.CheckoutSessionRetrieveParams{})
	if err != nil {
		return nil, err
	}

	return &stripeCheckoutSession{
		ID:                session.ID,
		URL:               session.URL,
		Status:            string(session.Status),
		PaymentStatus:     string(session.PaymentStatus),
		ClientReferenceID: session.ClientReferenceID,
		Metadata:          session.Metadata,
	}, nil
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
