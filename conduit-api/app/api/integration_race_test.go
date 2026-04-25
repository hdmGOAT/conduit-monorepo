package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/jackc/pgx/v5/pgtype"
	stripe "github.com/stripe/stripe-go/v84"
)

func TestConcurrentCreatePaymentNearTransactionCap(t *testing.T) {
	t.Parallel()

	const (
		callerID     int64 = 42
		groupID      int64 = 7
		collectionID int64 = 99
		capacity     int32 = 5
		concurrency        = 10
	)

	var (
		txMu       sync.Mutex
		stateMu    sync.Mutex
		usageCount int32 = capacity - 1
		paymentID  int64
	)

	fake := &fakeDB{}
	fake.withinTxFn = func(ctx context.Context, fn func(db.Querier) error) error {
		txMu.Lock()
		defer txMu.Unlock()
		return fn(fake)
	}
	fake.getCollectionFn = func(ctx context.Context, id int64) (db.Collection, error) {
		return db.Collection{ID: id, GroupID: groupID, Amount: 1000, Status: db.CollectionStatusActive}, nil
	}
	fake.getGroupByIDFn = func(ctx context.Context, id int64) (db.Group, error) {
		return db.Group{ID: id, OwnerID: 1}, nil
	}
	fake.listGroupMembershipsFn = func(ctx context.Context, gid int64) ([]db.Membership, error) {
		return []db.Membership{{UserID: callerID, GroupID: gid, Role: db.MembershipRoleMember}}, nil
	}
	fake.getOrganizationSubscriptionByGroupFn = func(ctx context.Context, gid int64) (db.OrganizationSubscription, error) {
		return db.OrganizationSubscription{
			GroupID:                      gid,
			Tier:                         db.SubscriptionTierFree,
			MemberLimit:                  25,
			TransactionCapacityPerPeriod: capacity,
			TransactionFeeBps:            0,
		}, nil
	}
	fake.getUsagePeriodByGroupAndStartFn = func(ctx context.Context, arg db.GetUsagePeriodByGroupAndStartParams) (db.SubscriptionUsagePeriod, error) {
		stateMu.Lock()
		defer stateMu.Unlock()
		return db.SubscriptionUsagePeriod{GroupID: arg.GroupID, PeriodStart: arg.PeriodStart, PeriodEnd: pgtype.Timestamptz{}, TransactionCount: usageCount}, nil
	}
	fake.createPaymentFn = func(ctx context.Context, arg db.CreatePaymentParams) (db.Payment, error) {
		stateMu.Lock()
		defer stateMu.Unlock()
		paymentID++
		usageCount++
		return db.Payment{ID: paymentID, Status: db.PaymentStatusPending, Method: arg.Column6, StripePaymentIntentID: arg.StripePaymentIntentID, CreatedAt: pgtype.Timestamptz{}}, nil
	}
	fake.createCashPaymentFn = func(ctx context.Context, paymentID int64) (db.CashPayment, error) {
		return db.CashPayment{ID: paymentID, PaymentID: paymentID, Status: db.CashPaymentStatusPending}, nil
	}

	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		return callerID, nil
	}}

	router := newTestRouterWithDeps(svc, fake)

	var okCount int64
	var conflictCount int64
	var unexpectedMu sync.Mutex
	var unexpected []string
	var wg sync.WaitGroup
	wg.Add(concurrency)
	for i := 0; i < concurrency; i++ {
		go func() {
			defer wg.Done()
			resp := performAuthJSONRequest(router, http.MethodPost, fmt.Sprintf("/api/collections/%d/payments", collectionID), map[string]any{"method": "cash"}, "token")
			switch resp.Code {
			case http.StatusOK:
				atomic.AddInt64(&okCount, 1)
			case http.StatusConflict:
				atomic.AddInt64(&conflictCount, 1)
			default:
				unexpectedMu.Lock()
				unexpected = append(unexpected, fmt.Sprintf("unexpected status %d body=%s", resp.Code, resp.Body.String()))
				unexpectedMu.Unlock()
			}
		}()
	}
	wg.Wait()

	if len(unexpected) > 0 {
		t.Fatalf("got %d unexpected responses; first: %s", len(unexpected), unexpected[0])
	}

	if okCount != 1 {
		t.Fatalf("expected exactly 1 success near cap, got %d", okCount)
	}
	if conflictCount != int64(concurrency-1) {
		t.Fatalf("expected %d conflicts, got %d", concurrency-1, conflictCount)
	}
}

func TestConcurrentAddMembershipNearMemberLimit(t *testing.T) {
	t.Parallel()

	const (
		callerID    int64 = 42
		groupID     int64 = 11
		memberLimit int32 = 5
		concurrency       = 10
	)

	var (
		txMu    sync.Mutex
		stateMu sync.Mutex
		members = map[int64]db.MembershipRole{
			callerID: db.MembershipRoleAdmin,
			100:      db.MembershipRoleMember,
			101:      db.MembershipRoleMember,
			102:      db.MembershipRoleMember,
		}
	)

	fake := &fakeDB{}
	fake.withinTxFn = func(ctx context.Context, fn func(db.Querier) error) error {
		txMu.Lock()
		defer txMu.Unlock()
		return fn(fake)
	}
	fake.getGroupByIDFn = func(ctx context.Context, id int64) (db.Group, error) {
		return db.Group{ID: id, OwnerID: 1}, nil
	}
	fake.listGroupMembershipsFn = func(ctx context.Context, gid int64) ([]db.Membership, error) {
		stateMu.Lock()
		defer stateMu.Unlock()
		out := make([]db.Membership, 0, len(members))
		for uid, role := range members {
			out = append(out, db.Membership{UserID: uid, GroupID: gid, Role: role})
		}
		return out, nil
	}
	fake.getOrganizationSubscriptionByGroupFn = func(ctx context.Context, gid int64) (db.OrganizationSubscription, error) {
		return db.OrganizationSubscription{GroupID: gid, Tier: db.SubscriptionTierFree, MemberLimit: memberLimit, TransactionCapacityPerPeriod: 250, TransactionFeeBps: 50}, nil
	}
	fake.countMembersByGroupFn = func(ctx context.Context, gid int64) (int64, error) {
		stateMu.Lock()
		defer stateMu.Unlock()
		return int64(len(members)), nil
	}
	fake.addMembershipFn = func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
		stateMu.Lock()
		defer stateMu.Unlock()
		members[arg.Column1] = arg.Column3
		return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: arg.Column3}, nil
	}

	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		return callerID, nil
	}}
	router := newTestRouterWithDeps(svc, fake)

	var okCount int64
	var conflictCount int64
	var unexpectedMu sync.Mutex
	var unexpected []string
	var wg sync.WaitGroup
	wg.Add(concurrency)
	for i := 0; i < concurrency; i++ {
		userID := int64(1000 + i)
		go func(uid int64) {
			defer wg.Done()
			resp := performAuthJSONRequest(router, http.MethodPost, fmt.Sprintf("/api/groups/%d/memberships", groupID), map[string]any{"user_id": uid, "role": "member"}, "token")
			switch resp.Code {
			case http.StatusOK:
				atomic.AddInt64(&okCount, 1)
			case http.StatusConflict:
				atomic.AddInt64(&conflictCount, 1)
			default:
				unexpectedMu.Lock()
				unexpected = append(unexpected, fmt.Sprintf("unexpected status %d body=%s", resp.Code, resp.Body.String()))
				unexpectedMu.Unlock()
			}
		}(userID)
	}
	wg.Wait()

	if len(unexpected) > 0 {
		t.Fatalf("got %d unexpected responses; first: %s", len(unexpected), unexpected[0])
	}

	if okCount != 1 {
		t.Fatalf("expected exactly 1 member added near limit, got %d", okCount)
	}
	if conflictCount != int64(concurrency-1) {
		t.Fatalf("expected %d conflicts, got %d", concurrency-1, conflictCount)
	}
}

func TestStripeWebhookDuplicateEventsOnlyOneTransitionPath(t *testing.T) {
	t.Parallel()

	const webhookSecret = "whsec_test_123"

	var stateMu sync.Mutex
	status := db.PaymentStatusPending
	var markPaidCalls int64

	fake := &fakeDB{
		getPaymentByStripePaymentIntentIDFn: func(ctx context.Context, stripePaymentIntentID string) (db.Payment, error) {
			stateMu.Lock()
			defer stateMu.Unlock()
			return db.Payment{ID: 91, Status: status, StripePaymentIntentID: pgtype.Text{String: stripePaymentIntentID, Valid: true}}, nil
		},
		markPaymentPaidFn: func(ctx context.Context, id int64) (db.Payment, error) {
			stateMu.Lock()
			defer stateMu.Unlock()
			if status != db.PaymentStatusPending {
				return db.Payment{}, sql.ErrNoRows
			}
			status = db.PaymentStatusPaid
			atomic.AddInt64(&markPaidCalls, 1)
			return db.Payment{ID: id, Status: status}, nil
		},
		markPaymentFailedFn: func(ctx context.Context, id int64) (db.Payment, error) {
			stateMu.Lock()
			defer stateMu.Unlock()
			if status != db.PaymentStatusPending {
				return db.Payment{}, sql.ErrNoRows
			}
			status = db.PaymentStatusFailed
			return db.Payment{ID: id, Status: status}, nil
		},
	}

	stripeGateway := &fakeStripeGateway{parseWebhookEventFn: func(payload []byte, signature string) (stripeWebhookEvent, error) {
		return (&stripeClient{webhookSecret: webhookSecret}).ParseWebhookEvent(payload, signature)
	}}

	router := newTestRouterWithDeps(&fakeAuthService{}, fake, stripeGateway)

	const duplicateCount = 8
	var unexpectedMu sync.Mutex
	var unexpected []string
	var wg sync.WaitGroup
	wg.Add(duplicateCount)
	for i := 0; i < duplicateCount; i++ {
		go func() {
			defer wg.Done()
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, newSignedStripeWebhookRequest(t, string(stripe.EventTypePaymentIntentSucceeded), "pi_dup_1", webhookSecret))
			if resp.Code != http.StatusOK {
				unexpectedMu.Lock()
				unexpected = append(unexpected, fmt.Sprintf("expected 200, got %d body=%s", resp.Code, resp.Body.String()))
				unexpectedMu.Unlock()
			}
		}()
	}
	wg.Wait()

	if len(unexpected) > 0 {
		t.Fatalf("got %d unexpected webhook responses; first: %s", len(unexpected), unexpected[0])
	}

	if got := atomic.LoadInt64(&markPaidCalls); got != 1 {
		t.Fatalf("expected exactly one paid transition, got %d", got)
	}
	if status != db.PaymentStatusPaid {
		t.Fatalf("expected final status paid, got %s", status)
	}
}

func TestCreatePaymentReturnsCapacityErrorShape(t *testing.T) {
	t.Parallel()

	const (
		callerID     int64 = 42
		groupID      int64 = 3
		collectionID int64 = 4
		capacity     int32 = 2
	)

	periodStart, periodEnd := billingPeriodBounds(time.Now().UTC())

	fake := &fakeDB{
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: groupID, Amount: 1000, Status: db.CollectionStatusActive}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 1}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, gid int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: callerID, GroupID: gid, Role: db.MembershipRoleMember}}, nil
		},
		getOrganizationSubscriptionByGroupFn: func(ctx context.Context, gid int64) (db.OrganizationSubscription, error) {
			return db.OrganizationSubscription{GroupID: gid, Tier: db.SubscriptionTierFree, MemberLimit: 25, TransactionCapacityPerPeriod: capacity, TransactionFeeBps: 50}, nil
		},
		getUsagePeriodByGroupAndStartFn: func(ctx context.Context, arg db.GetUsagePeriodByGroupAndStartParams) (db.SubscriptionUsagePeriod, error) {
			return db.SubscriptionUsagePeriod{GroupID: arg.GroupID, PeriodStart: periodStart, PeriodEnd: periodEnd, TransactionCount: capacity}, nil
		},
	}

	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		return callerID, nil
	}}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, fmt.Sprintf("/api/collections/%d/payments", collectionID), map[string]any{"method": "cash"}, "token")
	if resp.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", resp.Code, resp.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["code"] != "transaction_capacity_reached" {
		t.Fatalf("expected transaction_capacity_reached, got %#v", body["code"])
	}
	if int64(body["limit"].(float64)) != int64(capacity) {
		t.Fatalf("unexpected limit value: %#v", body["limit"])
	}
}

func TestAddMembershipReturnsMemberLimitErrorShape(t *testing.T) {
	t.Parallel()

	const (
		callerID    int64 = 42
		groupID     int64 = 19
		memberLimit int32 = 2
	)

	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 1}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, gid int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: callerID, GroupID: gid, Role: db.MembershipRoleAdmin}, {UserID: 100, GroupID: gid, Role: db.MembershipRoleMember}}, nil
		},
		getOrganizationSubscriptionByGroupFn: func(ctx context.Context, gid int64) (db.OrganizationSubscription, error) {
			return db.OrganizationSubscription{GroupID: gid, Tier: db.SubscriptionTierFree, MemberLimit: memberLimit, TransactionCapacityPerPeriod: 250, TransactionFeeBps: 50}, nil
		},
		countMembersByGroupFn: func(ctx context.Context, gid int64) (int64, error) {
			return int64(memberLimit), nil
		},
	}

	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		return callerID, nil
	}}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, fmt.Sprintf("/api/groups/%d/memberships", groupID), map[string]any{"user_id": 999, "role": "member"}, "token")
	if resp.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d body=%s", resp.Code, resp.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["code"] != "member_limit_reached" {
		t.Fatalf("expected member_limit_reached, got %#v", body["code"])
	}
	if int64(body["limit"].(float64)) != int64(memberLimit) {
		t.Fatalf("unexpected limit value: %#v", body["limit"])
	}
}
