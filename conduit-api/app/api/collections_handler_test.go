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

func TestCreateCollection_OwnerCanManageWithoutAdminMembership(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "G", IsOpen: false}, nil
		},
		createCollectionFn: func(ctx context.Context, arg db.CreateCollectionParams) (db.Collection, error) {
			return db.Collection{ID: 777, GroupID: arg.GroupID, Amount: arg.Amount, Deadline: arg.Deadline, CreatedAt: pgtype.Timestamptz{}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		if accessToken == "valid-access" {
			return 42, nil
		}
		return 0, errors.New("bad token")
	}}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/5/collections", map[string]any{"amount": 1000, "deadline": "2026-12-31T23:59:59Z"}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if id, ok := out["id"].(float64); !ok || int64(id) != 777 {
		t.Fatalf("expected id 777, got %v", out["id"])
	}
}

func TestUpdateCollection_AdminSuccess(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleAdmin}}, nil
		},
		updateCollectionFn: func(ctx context.Context, arg db.UpdateCollectionParams) (db.Collection, error) {
			return db.Collection{ID: arg.ID, GroupID: 5, Amount: arg.Amount, Deadline: arg.Deadline, CreatedAt: pgtype.Timestamptz{}}, nil
		},
	}

	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		if accessToken == "valid-access" {
			return 42, nil
		}
		return 0, errors.New("bad token")
	}}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5/collections/10", map[string]any{"amount": 2000, "deadline": "2026-01-01T00:00:00Z"}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if id, ok := out["id"].(float64); !ok || int64(id) != 10 {
		t.Fatalf("expected id 10, got %v", out["id"])
	}
}

func TestUpdateCollection_ForbiddenNonAdmin(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5/collections/10", map[string]any{"amount": 2000, "deadline": "2026-01-01T00:00:00Z"}, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
}

func TestDeleteCollection_AdminSuccess(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleAdmin}}, nil
		},
		deleteCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5/collections/10", nil, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}
