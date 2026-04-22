package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/jackc/pgx/v5/pgtype"
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
