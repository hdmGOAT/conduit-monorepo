package api

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	stripe "github.com/stripe/stripe-go/v84"
)

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
	normalizedCurrency := strings.ToLower(strings.TrimSpace(currency))
	if normalizedCurrency == "" {
		normalizedCurrency = string(stripe.CurrencyUSD)
	}

	return &stripeClient{
		client:        stripe.NewClient(secretKey),
		webhookSecret: strings.TrimSpace(webhookSecret),
		currency:      normalizedCurrency,
	}
}

func (s *stripeClient) CreatePaymentIntent(ctx context.Context, amount int64, metadata map[string]string) (*stripePaymentIntent, error) {
	if s == nil {
		return nil, fmt.Errorf("stripe gateway is not configured")
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

	return &stripePaymentIntent{
		ID:           intent.ID,
		ClientSecret: stringFieldValue(intent, "ClientSecret"),
	}, nil
}

func (s *stripeClient) ParseWebhookEvent(payload []byte, signature string) (stripeWebhookEvent, error) {
	if s == nil {
		return stripeWebhookEvent{}, fmt.Errorf("stripe gateway is not configured")
	}
	if s.webhookSecret == "" {
		return stripeWebhookEvent{}, fmt.Errorf("stripe webhook secret is not configured")
	}

	event, err := stripe.ConstructEvent(payload, signature, s.webhookSecret)
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

func stringFieldValue(value any, fieldName string) string {
	if value == nil {
		return ""
	}

	field := reflect.ValueOf(value)
	if field.Kind() != reflect.Ptr || field.IsNil() {
		return ""
	}
	field = field.Elem()
	if field.Kind() != reflect.Struct {
		return ""
	}

	member := field.FieldByName(fieldName)
	if !member.IsValid() {
		return ""
	}
	switch member.Kind() {
	case reflect.String:
		return member.String()
	case reflect.Ptr:
		if member.IsNil() {
			return ""
		}
		if member.Elem().Kind() == reflect.String {
			return member.Elem().String()
		}
	}

	return ""
}
