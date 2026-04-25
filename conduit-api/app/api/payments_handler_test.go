package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/jackc/pgx/v5/pgtype"
	stripe "github.com/stripe/stripe-go/v84"
	"github.com/stripe/stripe-go/v84/webhook"
)

func TestCreatePayment_MemberCanCreatePendingPaymentForActiveCollection(t *testing.T) {
	called := false
	fake := &fakeDB{
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5, Amount: 2500, Status: db.CollectionStatusActive}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 99}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
		createPaymentFn: func(ctx context.Context, arg db.CreatePaymentParams) (db.Payment, error) {
			called = true
			if arg.UserID != 42 || arg.CollectionID != 10 || arg.Amount != 2500 || arg.Column4 != db.PaymentMethodCash {
				t.Fatalf("unexpected create args: %#v", arg)
			}
			return db.Payment{ID: 88, UserID: arg.UserID, CollectionID: arg.CollectionID, Amount: arg.Amount, Status: db.PaymentStatusPending, Method: arg.Column4, StripePaymentIntentID: arg.StripePaymentIntentID, CreatedAt: pgtype.Timestamptz{}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		if accessToken == "valid-access" {
			return 42, nil
		}
		return 0, errors.New("bad token")
	}}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/collections/10/payments", map[string]any{"method": "cash"}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if !called {
		t.Fatal("expected create payment to be called")
	}

	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if id, ok := out["id"].(float64); !ok || int64(id) != 88 {
		t.Fatalf("expected id 88, got %v", out["id"])
	}
	if status, ok := out["status"].(string); !ok || status != string(db.PaymentStatusPending) {
		t.Fatalf("expected pending status, got %v", out["status"])
	}
	if method, ok := out["method"].(string); !ok || method != string(db.PaymentMethodCash) {
		t.Fatalf("expected cash method, got %v", out["method"])
	}
}

type fakeStripeGateway struct {
	createPaymentIntentFn func(ctx context.Context, amount int64, metadata map[string]string) (*stripePaymentIntent, error)
	parseWebhookEventFn   func(payload []byte, signature string) (stripeWebhookEvent, error)
}

func (f *fakeStripeGateway) CreatePaymentIntent(ctx context.Context, amount int64, metadata map[string]string) (*stripePaymentIntent, error) {
	if f.createPaymentIntentFn != nil {
		return f.createPaymentIntentFn(ctx, amount, metadata)
	}
	return &stripePaymentIntent{}, nil
}

func (f *fakeStripeGateway) ParseWebhookEvent(payload []byte, signature string) (stripeWebhookEvent, error) {
	if f.parseWebhookEventFn != nil {
		return f.parseWebhookEventFn(payload, signature)
	}
	return stripeWebhookEvent{}, nil
}

func newSignedStripeWebhookRequest(t *testing.T, eventType, paymentIntentID, secret string) *http.Request {
	t.Helper()

	now := time.Now().UTC()
	payload, err := json.Marshal(map[string]any{
		"id":          "evt_test_123",
		"object":      "event",
		"api_version": stripe.APIVersion,
		"created":     now.Unix(),
		"livemode":    false,
		"type":        eventType,
		"data": map[string]any{
			"object": map[string]any{
				"id":     paymentIntentID,
				"object": "payment_intent",
			},
		},
	})
	if err != nil {
		t.Fatalf("failed to marshal webhook payload: %v", err)
	}

	signedPayload := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{
		Payload:   payload,
		Secret:    secret,
		Timestamp: now,
		Scheme:    "v1",
	})

	req, err := http.NewRequest(http.MethodPost, "/api/webhooks/stripe", strings.NewReader(string(payload)))
	if err != nil {
		t.Fatalf("failed to build webhook request: %v", err)
	}
	req.Header.Set("Stripe-Signature", signedPayload.Header)
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestCreatePayment_StripeCreatesPaymentIntent(t *testing.T) {
	called := false
	fakeStripe := &fakeStripeGateway{
		createPaymentIntentFn: func(ctx context.Context, amount int64, metadata map[string]string) (*stripePaymentIntent, error) {
			called = true
			if amount != 2500 {
				t.Fatalf("expected amount 2500, got %d", amount)
			}
			if metadata["collection_id"] != "10" || metadata["user_id"] != "42" || metadata["amount"] != "2500" {
				t.Fatalf("unexpected metadata: %#v", metadata)
			}
			return &stripePaymentIntent{ID: "pi_test_123", ClientSecret: "secret_test_123"}, nil
		},
	}
	fake := &fakeDB{
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5, Amount: 2500, Status: db.CollectionStatusActive}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 99}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
		createPaymentFn: func(ctx context.Context, arg db.CreatePaymentParams) (db.Payment, error) {
			if arg.StripePaymentIntentID.String != "pi_test_123" || !arg.StripePaymentIntentID.Valid {
				t.Fatalf("expected stripe payment intent id to be stored, got %#v", arg.StripePaymentIntentID)
			}
			return db.Payment{ID: 88, UserID: arg.UserID, CollectionID: arg.CollectionID, Amount: arg.Amount, Status: db.PaymentStatusPending, Method: arg.Column4, StripePaymentIntentID: arg.StripePaymentIntentID, CreatedAt: pgtype.Timestamptz{}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		if accessToken == "valid-access" {
			return 42, nil
		}
		return 0, errors.New("bad token")
	}}

	router := newTestRouterWithDeps(svc, fake, fakeStripe)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/collections/10/payments", map[string]any{"method": "stripe"}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if !called {
		t.Fatal("expected stripe intent creation to be called")
	}

	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if paymentIntent, ok := out["stripe_payment_intent"].(map[string]any); !ok || paymentIntent["id"] != "pi_test_123" || paymentIntent["client_secret"] != "secret_test_123" {
		t.Fatalf("expected stripe payment intent payload, got %v", out["stripe_payment_intent"])
	}
}

func TestStripeWebhook_TransitionsAreIdempotent(t *testing.T) {
	webhookSecret := "whsec_test_123"
	paidCalls := 0
	failedCalls := 0
	paymentStatus := db.PaymentStatusPending
	fake := &fakeDB{
		getPaymentByStripePaymentIntentIDFn: func(ctx context.Context, stripePaymentIntentID string) (db.Payment, error) {
			return db.Payment{ID: 91, Status: paymentStatus, StripePaymentIntentID: pgtype.Text{String: stripePaymentIntentID, Valid: true}}, nil
		},
		markPaymentPaidFn: func(ctx context.Context, id int64) (db.Payment, error) {
			if paymentStatus != db.PaymentStatusPending {
				return db.Payment{}, sql.ErrNoRows
			}
			paidCalls++
			paymentStatus = db.PaymentStatusPaid
			return db.Payment{ID: id, Status: paymentStatus}, nil
		},
		markPaymentFailedFn: func(ctx context.Context, id int64) (db.Payment, error) {
			if paymentStatus != db.PaymentStatusPending {
				return db.Payment{}, sql.ErrNoRows
			}
			failedCalls++
			paymentStatus = db.PaymentStatusFailed
			return db.Payment{ID: id, Status: db.PaymentStatusFailed}, nil
		},
	}
	stripeGateway := &fakeStripeGateway{
		parseWebhookEventFn: func(payload []byte, signature string) (stripeWebhookEvent, error) {
			return (&stripeClient{webhookSecret: webhookSecret}).ParseWebhookEvent(payload, signature)
		},
	}
	router := newTestRouterWithDeps(&fakeAuthService{}, fake, stripeGateway)

	newWebhookRequest := func() *http.Request {
		return newSignedStripeWebhookRequest(t, string(stripe.EventTypePaymentIntentSucceeded), "pi_test_123", webhookSecret)
	}

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, newWebhookRequest())
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if paidCalls != 1 || failedCalls != 0 {
		t.Fatalf("expected exactly one paid transition, got paid=%d failed=%d", paidCalls, failedCalls)
	}

	resp = httptest.NewRecorder()
	router.ServeHTTP(resp, newWebhookRequest())
	if resp.Code != http.StatusOK {
		t.Fatalf("expected duplicate webhook to still return 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if paidCalls != 1 {
		t.Fatalf("expected second webhook to be a no-op, got paid calls=%d", paidCalls)
	}
}

func TestStripePaymentFlow_CreateThenWebhookTransitions(t *testing.T) {
	const (
		webhookSecret   = "whsec_test_123"
		paymentIntentID = "pi_test_123"
	)

	tests := []struct {
		name           string
		eventType      string
		expectedStatus db.PaymentStatus
		expectedPaid   int
		expectedFailed int
	}{
		{
			name:           "payment intent succeeded",
			eventType:      string(stripe.EventTypePaymentIntentSucceeded),
			expectedStatus: db.PaymentStatusPaid,
			expectedPaid:   1,
		},
		{
			name:           "payment intent failed",
			eventType:      string(stripe.EventTypePaymentIntentPaymentFailed),
			expectedStatus: db.PaymentStatusFailed,
			expectedFailed: 1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			paymentsByIntentID := map[string]db.Payment{}
			paidCalls := 0
			failedCalls := 0

			fake := &fakeDB{
				getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
					return db.Collection{ID: id, GroupID: 5, Amount: 2500, Status: db.CollectionStatusActive}, nil
				},
				getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
					return db.Group{ID: id, OwnerID: 99}, nil
				},
				listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
					return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
				},
				createPaymentFn: func(ctx context.Context, arg db.CreatePaymentParams) (db.Payment, error) {
					if arg.UserID != 42 || arg.CollectionID != 10 || arg.Amount != 2500 || arg.Column4 != db.PaymentMethodStripe {
						t.Fatalf("unexpected create args: %#v", arg)
					}
					if !arg.StripePaymentIntentID.Valid || arg.StripePaymentIntentID.String != paymentIntentID {
						t.Fatalf("expected stripe payment intent id to be stored, got %#v", arg.StripePaymentIntentID)
					}

					payment := db.Payment{
						ID:                    88,
						UserID:                arg.UserID,
						CollectionID:          arg.CollectionID,
						Amount:                arg.Amount,
						Status:                db.PaymentStatusPending,
						Method:                arg.Column4,
						StripePaymentIntentID: arg.StripePaymentIntentID,
						CreatedAt:             pgtype.Timestamptz{},
					}
					paymentsByIntentID[paymentIntentID] = payment
					return payment, nil
				},
				getPaymentByStripePaymentIntentIDFn: func(ctx context.Context, stripePaymentIntentID string) (db.Payment, error) {
					payment, ok := paymentsByIntentID[stripePaymentIntentID]
					if !ok {
						return db.Payment{}, sql.ErrNoRows
					}
					return payment, nil
				},
				markPaymentPaidFn: func(ctx context.Context, id int64) (db.Payment, error) {
					payment, ok := paymentsByIntentID[paymentIntentID]
					if !ok || payment.ID != id {
						t.Fatalf("unexpected payment id for paid transition: got %d, want %d", id, payment.ID)
					}
					if payment.Status != db.PaymentStatusPending {
						return db.Payment{}, sql.ErrNoRows
					}
					paidCalls++
					payment.Status = db.PaymentStatusPaid
					paymentsByIntentID[paymentIntentID] = payment
					return payment, nil
				},
				markPaymentFailedFn: func(ctx context.Context, id int64) (db.Payment, error) {
					payment, ok := paymentsByIntentID[paymentIntentID]
					if !ok || payment.ID != id {
						t.Fatalf("unexpected payment id for failed transition: got %d, want %d", id, payment.ID)
					}
					if payment.Status != db.PaymentStatusPending {
						return db.Payment{}, sql.ErrNoRows
					}
					failedCalls++
					payment.Status = db.PaymentStatusFailed
					paymentsByIntentID[paymentIntentID] = payment
					return payment, nil
				},
			}

			fakeStripe := &fakeStripeGateway{
				createPaymentIntentFn: func(ctx context.Context, amount int64, metadata map[string]string) (*stripePaymentIntent, error) {
					if amount != 2500 {
						t.Fatalf("expected amount 2500, got %d", amount)
					}
					if metadata["collection_id"] != "10" || metadata["user_id"] != "42" || metadata["amount"] != "2500" {
						t.Fatalf("unexpected metadata: %#v", metadata)
					}
					return &stripePaymentIntent{ID: paymentIntentID, ClientSecret: "secret_test_123"}, nil
				},
				parseWebhookEventFn: func(payload []byte, signature string) (stripeWebhookEvent, error) {
					return (&stripeClient{webhookSecret: webhookSecret}).ParseWebhookEvent(payload, signature)
				},
			}

			svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
				if accessToken == "valid-access" {
					return 42, nil
				}
				return 0, errors.New("bad token")
			}}

			router := newTestRouterWithDeps(svc, fake, fakeStripe)
			createResp := performAuthJSONRequest(router, http.MethodPost, "/api/collections/10/payments", map[string]any{"method": "stripe"}, "valid-access")
			if createResp.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", createResp.Code, createResp.Body.String())
			}

			var createOut map[string]any
			if err := json.Unmarshal(createResp.Body.Bytes(), &createOut); err != nil {
				t.Fatalf("failed to parse create payment response: %v", err)
			}
			stripeIntent, ok := createOut["stripe_payment_intent"].(map[string]any)
			if !ok || stripeIntent["id"] != paymentIntentID || stripeIntent["client_secret"] != "secret_test_123" {
				t.Fatalf("unexpected stripe payment intent response: %v", createOut["stripe_payment_intent"])
			}

			if got := paymentsByIntentID[paymentIntentID].Status; got != db.PaymentStatusPending {
				t.Fatalf("expected payment to start pending, got %s", got)
			}

			webhookReq := newSignedStripeWebhookRequest(t, tc.eventType, paymentIntentID, webhookSecret)
			webhookResp := httptest.NewRecorder()
			router.ServeHTTP(webhookResp, webhookReq)
			if webhookResp.Code != http.StatusOK {
				t.Fatalf("expected 200 from webhook, got %d: %s", webhookResp.Code, webhookResp.Body.String())
			}

			if got := paymentsByIntentID[paymentIntentID].Status; got != tc.expectedStatus {
				t.Fatalf("expected final status %s, got %s", tc.expectedStatus, got)
			}
			if paidCalls != tc.expectedPaid || failedCalls != tc.expectedFailed {
				t.Fatalf("expected transition counts paid=%d failed=%d, got paid=%d failed=%d", tc.expectedPaid, tc.expectedFailed, paidCalls, failedCalls)
			}

			duplicateReq := newSignedStripeWebhookRequest(t, tc.eventType, paymentIntentID, webhookSecret)
			duplicateResp := httptest.NewRecorder()
			router.ServeHTTP(duplicateResp, duplicateReq)
			if duplicateResp.Code != http.StatusOK {
				t.Fatalf("expected 200 from duplicate webhook, got %d: %s", duplicateResp.Code, duplicateResp.Body.String())
			}
			if paidCalls != tc.expectedPaid || failedCalls != tc.expectedFailed {
				t.Fatalf("expected duplicate webhook to be a no-op, got paid=%d failed=%d", paidCalls, failedCalls)
			}
		})
	}
}

func TestCreatePayment_ClosedCollectionRejected(t *testing.T) {
	called := false
	fake := &fakeDB{
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5, Amount: 2500, Status: db.CollectionStatusClosed}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 99}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
		createPaymentFn: func(ctx context.Context, arg db.CreatePaymentParams) (db.Payment, error) {
			called = true
			return db.Payment{}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/collections/10/payments", map[string]any{"method": "stripe"}, "valid-access")
	if resp.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", resp.Code, resp.Body.String())
	}
	if called {
		t.Fatal("did not expect create payment to be called for closed collection")
	}
}

func TestCreatePayment_ForbiddenForNonMember(t *testing.T) {
	fake := &fakeDB{
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5, Amount: 2500, Status: db.CollectionStatusActive}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 99}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/collections/10/payments", map[string]any{"method": "cash"}, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestListPaymentsByCollection_ReturnsMostRecentFirst(t *testing.T) {
	fake := &fakeDB{
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5, Amount: 2500, Status: db.CollectionStatusActive}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 99}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
		listPaymentsByCollectionFn: func(ctx context.Context, collectionID int64) ([]db.Payment, error) {
			return []db.Payment{
				{ID: 9, UserID: 42, CollectionID: collectionID, Amount: 2500, Status: db.PaymentStatusPending, Method: db.PaymentMethodStripe, CreatedAt: pgtype.Timestamptz{}},
				{ID: 3, UserID: 43, CollectionID: collectionID, Amount: 2500, Status: db.PaymentStatusPaid, Method: db.PaymentMethodCash, CreatedAt: pgtype.Timestamptz{}},
			}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodGet, "/api/collections/10/payments", nil, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var out []map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("expected 2 payments, got %d", len(out))
	}
	if id, ok := out[0]["id"].(float64); !ok || int64(id) != 9 {
		t.Fatalf("expected newest payment first, got %v", out[0]["id"])
	}
	if id, ok := out[1]["id"].(float64); !ok || int64(id) != 3 {
		t.Fatalf("expected older payment second, got %v", out[1]["id"])
	}
}

func TestListPaymentsByCollection_RequiresAuthentication(t *testing.T) {
	router := newTestRouterWithDeps(&fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 0, nil }}, &fakeDB{})
	resp := performAuthJSONRequest(router, http.MethodGet, "/api/collections/10/payments", nil, "")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", resp.Code, resp.Body.String())
	}
}
