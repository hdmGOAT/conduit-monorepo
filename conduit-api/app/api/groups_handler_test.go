package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
)

// use the centralized fake in fake_db_test.go
func newTestRouterWithDeps(service AuthService, dbq db.Querier, stripeGateway ...stripeGateway) *gin.Engine {
	return newTestRouterWithDepsAndDefaults(service, dbq, GroupSubscriptionDefaults{}, stripeGateway...)
}

func newTestRouterWithDepsAndDefaults(service AuthService, dbq db.Querier, defaults GroupSubscriptionDefaults, stripeGateway ...stripeGateway) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := NewAuthHandler(service, false, 3600)
	groupsHandler := NewGroupsHandler(dbq, defaults)
	collectionsHandler := NewCollectionsHandler(dbq)
	paymentsHandler := NewPaymentsHandler(dbq, stripeGateway...)
	formsHandler := NewFormsHandler(dbq)
	return NewRouter(handler, groupsHandler, collectionsHandler, paymentsHandler, formsHandler, service)
}

func performAuthJSONRequest(router *gin.Engine, method, path string, body any, token string) *httptest.ResponseRecorder {
	payload, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	return resp
}

func TestCreateGroup_Success(t *testing.T) {
	fake := &fakeDB{
		createGroupFn: func(ctx context.Context, arg db.CreateGroupParams) (db.Group, error) {
			return db.Group{ID: 123, OwnerID: arg.OwnerID, Name: arg.Name, IsOpen: arg.IsOpen, CreatedAt: pgtype.Timestamptz{}}, nil
		},
		addMembershipFn: func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: arg.Column3, CreatedAt: pgtype.Timestamptz{}}, nil
		},
	}

	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		if accessToken == "valid-access" {
			return 42, nil
		}
		return 0, errors.New("bad token")
	}}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups", map[string]string{"name": "Team"}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if out["id"] == nil || out["name"] != "Team" {
		t.Fatalf("unexpected response: %v", out)
	}
}

func TestCreateGroup_SetIsOpen(t *testing.T) {
	fake := &fakeDB{
		createGroupFn: func(ctx context.Context, arg db.CreateGroupParams) (db.Group, error) {
			return db.Group{ID: 456, OwnerID: arg.OwnerID, Name: arg.Name, IsOpen: arg.IsOpen, CreatedAt: pgtype.Timestamptz{}}, nil
		},
		addMembershipFn: func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: arg.Column3, CreatedAt: pgtype.Timestamptz{}}, nil
		},
	}

	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		if accessToken == "valid-access" {
			return 42, nil
		}
		return 0, errors.New("bad token")
	}}

	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups", map[string]any{"name": "OpenTeam", "is_open": true}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if v, ok := out["is_open"].(bool); !ok || v != true {
		t.Fatalf("expected is_open true, got %v", out)
	}
}

func TestCreateGroup_InitializesSubscriptionWithDefaults(t *testing.T) {
	fake := &fakeDB{
		createGroupFn: func(ctx context.Context, arg db.CreateGroupParams) (db.Group, error) {
			return db.Group{ID: 789, OwnerID: arg.OwnerID, Name: arg.Name, IsOpen: arg.IsOpen, CreatedAt: pgtype.Timestamptz{}}, nil
		},
		addMembershipFn: func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: arg.Column3, CreatedAt: pgtype.Timestamptz{}}, nil
		},
		upsertOrganizationSubscriptionFn: func(ctx context.Context, arg db.UpsertOrganizationSubscriptionParams) (db.OrganizationSubscription, error) {
			if arg.GroupID != 789 {
				t.Fatalf("expected subscription for group 789, got %d", arg.GroupID)
			}
			if arg.Tier != db.SubscriptionTierStarter {
				t.Fatalf("expected starter tier, got %s", arg.Tier)
			}
			if arg.MemberLimit != 50 || arg.TransactionCapacityPerPeriod != 1000 || arg.TransactionFeeBps != 75 {
				t.Fatalf("unexpected defaults: %+v", arg)
			}
			return db.OrganizationSubscription{GroupID: arg.GroupID, Tier: arg.Tier, MemberLimit: arg.MemberLimit, TransactionCapacityPerPeriod: arg.TransactionCapacityPerPeriod, TransactionFeeBps: arg.TransactionFeeBps}, nil
		},
	}

	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		if accessToken == "valid-access" {
			return 42, nil
		}
		return 0, errors.New("bad token")
	}}

	router := newTestRouterWithDepsAndDefaults(svc, fake, GroupSubscriptionDefaults{
		Tier:                         db.SubscriptionTierStarter,
		MemberLimit:                  50,
		TransactionCapacityPerPeriod: 1000,
		TransactionFeeBps:            75,
	})
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups", map[string]string{"name": "Team"}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestCreateGroup_Unauthorized_NoBearer(t *testing.T) {
	fake := &fakeDB{}
	svc := &fakeAuthService{}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups", map[string]string{"name": "Team"}, "")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestCreateGroup_InvalidPayload(t *testing.T) {
	fake := &fakeDB{}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups", map[string]string{"wrong": "x"}, "valid-access")
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
}

func TestListOwnedGroups_Success(t *testing.T) {
	fake := &fakeDB{
		listGroupsByOwnerFn: func(ctx context.Context, ownerID int64) ([]db.Group, error) {
			return []db.Group{{ID: 1, OwnerID: ownerID, Name: "G1"}, {ID: 2, OwnerID: ownerID, Name: "G2"}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	req := httptest.NewRequest(http.MethodGet, "/api/groups/owned", nil)
	req.Header.Set("Authorization", "Bearer valid-access")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	var out []map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(out))
	}
}

func TestAddMembership_AdminSuccess(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleAdmin}}, nil
		},
		addMembershipFn: func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: arg.Column3}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/10/memberships", map[string]any{"user_id": 99, "role": string(db.MembershipRoleMember)}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestAddMembership_OwnerCanManageWithoutAdminMembership(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "G", IsOpen: false}, nil
		},
		addMembershipFn: func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: arg.Column3}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/10/memberships", map[string]any{"user_id": 99, "role": string(db.MembershipRoleMember)}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestAddMembership_Forbidden_NonAdmin(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/10/memberships", map[string]any{"user_id": 99, "role": string(db.MembershipRoleMember)}, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
}

func TestAddMembership_InvalidRole(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleAdmin}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/10/memberships", map[string]any{"user_id": 99, "role": "invalid"}, "valid-access")
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
}

func TestListMemberships_Success(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 1, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	req := httptest.NewRequest(http.MethodGet, "/api/groups/10/memberships", nil)
	req.Header.Set("Authorization", "Bearer valid-access")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	var out []map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if len(out) != 1 || out[0]["user_id"] == nil {
		t.Fatalf("unexpected response: %v", out)
	}
}

func TestRequestToJoin_OpenGroup_Succeeds(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 1, Name: "G", IsOpen: true}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return nil, nil
		},
		addMembershipFn: func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: arg.Column3}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/5/join", map[string]any{}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequestToJoin_ClosedGroupCreatesRequest(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 1, Name: "G", IsOpen: false}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return nil, nil
		},
		createJoinRequestFn: func(ctx context.Context, arg db.CreateJoinRequestParams) (db.JoinRequest, error) {
			return db.JoinRequest{UserID: arg.Column1, GroupID: arg.Column2, Status: arg.Column3}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/5/join", map[string]any{}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestRequestToJoin_AlreadyMemberReturnsOk(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 1, Name: "G", IsOpen: false}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/5/join", map[string]any{}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if out["message"] != "already a member" {
		t.Fatalf("expected already a member message, got %v", out)
	}
}

func TestRequestToJoin_ExistingJoinRequestReturnsOk(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 1, Name: "G", IsOpen: false}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return nil, nil
		},
		listJoinRequestsByGroupFn: func(ctx context.Context, groupID int64) ([]db.JoinRequest, error) {
			return []db.JoinRequest{{UserID: 42, GroupID: groupID, Status: db.JoinRequestStatusPending}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/5/join", map[string]any{}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if out["message"] != "join request already exists" {
		t.Fatalf("expected existing join request message, got %v", out)
	}
}

func TestHandleJoinRequest_AdminApproves(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleAdmin}}, nil
		},
		updateJoinRequestStatusFn: func(ctx context.Context, arg db.UpdateJoinRequestStatusParams) (db.JoinRequest, error) {
			return db.JoinRequest{UserID: arg.Column1, GroupID: arg.Column2, Status: arg.Column3}, nil
		},
		addMembershipFn: func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: arg.Column3}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5/join-requests/99", map[string]any{"status": "approved", "role": "member"}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestHandleJoinRequest_NonAdminForbidden(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5/join-requests/99", map[string]any{"status": "approved"}, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
}

func TestToggleIsOpen_OwnerSuccess(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "G", IsOpen: false}, nil
		},
		updateGroupIsOpenFn: func(ctx context.Context, arg db.UpdateGroupIsOpenParams) (db.Group, error) {
			return db.Group{ID: arg.ID, OwnerID: 42, Name: "G", IsOpen: arg.IsOpen}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5/is_open", map[string]any{"is_open": true}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if v, ok := out["is_open"].(bool); !ok || v != true {
		t.Fatalf("expected is_open true, got %v", out)
	}
}

func TestToggleIsOpen_OwnerCanClose(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "G", IsOpen: true}, nil
		},
		updateGroupIsOpenFn: func(ctx context.Context, arg db.UpdateGroupIsOpenParams) (db.Group, error) {
			return db.Group{ID: arg.ID, OwnerID: 42, Name: "G", IsOpen: arg.IsOpen}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5/is_open", map[string]any{"is_open": false}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if v, ok := out["is_open"].(bool); !ok || v != false {
		t.Fatalf("expected is_open false, got %v", out)
	}
}

func TestToggleIsOpen_Forbidden_NonOwner(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 99, Name: "G", IsOpen: false}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5/is_open", map[string]any{"is_open": true}, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
}

func TestLeaveGroup_Success(t *testing.T) {
	fake := &fakeDB{
		deleteMembershipFn: func(ctx context.Context, arg db.DeleteMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.UserID, GroupID: arg.GroupID, Role: db.MembershipRoleMember}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5/memberships/me", nil, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestEjectMember_AdminSuccess(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleAdmin}, {UserID: 99, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
		deleteMembershipFn: func(ctx context.Context, arg db.DeleteMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.UserID, GroupID: arg.GroupID, Role: db.MembershipRoleMember}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5/memberships/99", nil, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestEjectMember_ModeratorSuccess(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleModerator}, {UserID: 99, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
		deleteMembershipFn: func(ctx context.Context, arg db.DeleteMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.UserID, GroupID: arg.GroupID, Role: db.MembershipRoleMember}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5/memberships/99", nil, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestEjectMember_ModeratorCannotEjectAdmin(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleModerator}, {UserID: 99, GroupID: groupID, Role: db.MembershipRoleAdmin}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5/memberships/99", nil, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
}

func TestEjectMember_Forbidden_NonManager(t *testing.T) {
	fake := &fakeDB{
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5/memberships/99", nil, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
}

func TestUpdateGroup_OwnerSuccess(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "Old", IsOpen: false}, nil
		},
		updateGroupFn: func(ctx context.Context, arg db.UpdateGroupParams) (db.Group, error) {
			return db.Group{ID: arg.ID, OwnerID: 42, Name: arg.Name, IsOpen: false}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5", map[string]any{"name": "New"}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestUpdateGroup_Forbidden_NonOwner(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 99, Name: "Old", IsOpen: false}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5", map[string]any{"name": "New"}, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
}

func TestDeleteGroup_OwnerSuccess(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "G"}, nil
		},
		deleteGroupFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "G"}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5", nil, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestDeleteGroup_Forbidden_NonOwner(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 99, Name: "G"}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5", nil, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
}

func TestUpdateGroup_Unauthorized_NoBearer(t *testing.T) {
	fake := &fakeDB{}
	svc := &fakeAuthService{}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5", map[string]any{"name": "New"}, "")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestUpdateGroup_InvalidPayload(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "Old", IsOpen: false}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	// missing required 'name'
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5", map[string]any{}, "valid-access")
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
}

func TestUpdateGroup_DBError(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "Old", IsOpen: false}, nil
		},
		updateGroupFn: func(ctx context.Context, arg db.UpdateGroupParams) (db.Group, error) {
			return db.Group{}, errors.New("db fail")
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/5", map[string]any{"name": "New"}, "valid-access")
	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestUpdateGroup_InvalidGroupID(t *testing.T) {
	fake := &fakeDB{}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPatch, "/api/groups/abc", map[string]any{"name": "New"}, "valid-access")
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
}

func TestDeleteGroup_Unauthorized_NoBearer(t *testing.T) {
	fake := &fakeDB{}
	svc := &fakeAuthService{}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5", nil, "")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestDeleteGroup_DBError(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42, Name: "G"}, nil
		},
		deleteGroupFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{}, errors.New("db fail")
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5", nil, "valid-access")
	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestDeleteGroup_InvalidGroupID(t *testing.T) {
	fake := &fakeDB{}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/not-an-id", nil, "valid-access")
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
}

func TestDeleteGroup_GroupFetchError(t *testing.T) {
	fake := &fakeDB{
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{}, errors.New("not found")
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodDelete, "/api/groups/5", nil, "valid-access")
	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", resp.Code)
	}
}

func TestJoinWithCode_Success(t *testing.T) {
	fake := &fakeDB{
		getGroupByJoinCodeFn: func(ctx context.Context, joinCode string) (db.Group, error) {
			if joinCode == "validcode" {
				return db.Group{ID: 5, OwnerID: 1, Name: "G", JoinCode: joinCode}, nil
			}
			return db.Group{}, sql.ErrNoRows
		},
		addMembershipFn: func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
			return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: db.MembershipRoleMember}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/join-with-code", map[string]any{"code": "validcode"}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestJoinWithCode_InvalidCode(t *testing.T) {
	fake := &fakeDB{
		getGroupByJoinCodeFn: func(ctx context.Context, joinCode string) (db.Group, error) {
			return db.Group{}, sql.ErrNoRows
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/groups/join-with-code", map[string]any{"code": "invalid"}, "valid-access")
	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", resp.Code, resp.Body.String())
	}
}
