package api

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestCreateCollectionForm_Success(t *testing.T) {
	fake := &fakeDB{
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42}, nil
		},
		createCollectionFormFn: func(ctx context.Context, arg db.CreateCollectionFormParams) (db.CollectionForm, error) {
			return db.CollectionForm{ID: 20, CollectionID: arg.CollectionID, Title: arg.Title, Description: arg.Description, IsRequired: arg.IsRequired, CreatedAt: pgtype.Timestamptz{}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/collections/10/form", map[string]any{"title": "Signup", "description": "desc", "is_required": false}, "valid-access")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if id, ok := out["id"].(float64); !ok || int64(id) != 20 {
		t.Fatalf("expected id 20, got %v", out["id"])
	}
}

func TestCreateCollectionForm_ValidationError(t *testing.T) {
	fake := &fakeDB{
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/collections/10/form", map[string]any{"description": "no title"}, "valid-access")
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestCreateFormSubmission_SuccessAndUnauthorized(t *testing.T) {
	fake := &fakeDB{
		getCollectionFormByIDFn: func(ctx context.Context, id int64) (db.CollectionForm, error) {
			return db.CollectionForm{ID: id, CollectionID: 10}, nil
		},
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 99}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{{UserID: 42, GroupID: groupID, Role: db.MembershipRoleMember}}, nil
		},
		createFormSubmissionFn: func(ctx context.Context, arg db.CreateFormSubmissionParams) (db.CollectionFormSubmission, error) {
			return db.CollectionFormSubmission{ID: 30, FormID: arg.FormID, CollectionID: arg.CollectionID, UserID: arg.UserID, SubmittedAt: pgtype.Timestamptz{Time: time.Now(), Valid: true}}, nil
		},
		addFormAnswerFn: func(ctx context.Context, arg db.AddFormAnswerParams) (db.CollectionFormAnswer, error) {
			return db.CollectionFormAnswer{ID: 40, SubmissionID: arg.SubmissionID, FieldID: arg.FieldID, ValueText: arg.ValueText, CreatedAt: pgtype.Timestamptz{}}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) {
		if accessToken == "valid-access" {
			return 42, nil
		}
		return 0, nil
	}}
	router := newTestRouterWithDeps(svc, fake)

	// Unauthorized when no token
	resp := performAuthJSONRequest(router, http.MethodPost, "/api/forms/5/submissions", map[string]any{"collection_id": 10, "answers": []any{}}, "")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}

	// Successful submission
	resp2 := performAuthJSONRequest(router, http.MethodPost, "/api/forms/5/submissions", map[string]any{"collection_id": 10, "answers": []any{map[string]any{"field_id": 3, "value_text": "Alice"}}}, "valid-access")
	if resp2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp2.Code, resp2.Body.String())
	}
}

func TestCreateCollectionFormField_Validation(t *testing.T) {
	fake := &fakeDB{
		getCollectionFormByIDFn: func(ctx context.Context, id int64) (db.CollectionForm, error) {
			return db.CollectionForm{ID: id, CollectionID: 10}, nil
		},
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 5}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 42}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)

	invalidTypeResp := performAuthJSONRequest(
		router,
		http.MethodPost,
		"/api/forms/5/fields",
		map[string]any{"field_key": "name", "label": "Name", "field_type": "tel", "sort_order": 1},
		"valid-access",
	)
	if invalidTypeResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid field_type, got %d: %s", invalidTypeResp.Code, invalidTypeResp.Body.String())
	}

	missingSortOrderResp := performAuthJSONRequest(
		router,
		http.MethodPost,
		"/api/forms/5/fields",
		map[string]any{"field_key": "name", "label": "Name", "field_type": "text"},
		"valid-access",
	)
	if missingSortOrderResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing sort_order, got %d: %s", missingSortOrderResp.Code, missingSortOrderResp.Body.String())
	}
}

func TestGetCollectionForm_ForbiddenForNonMember(t *testing.T) {
	fake := &fakeDB{
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 7}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 999}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)

	resp := performAuthJSONRequest(router, http.MethodGet, "/api/collections/10/form", nil, "valid-access")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestCreateFormSubmission_ForbiddenForNonMember(t *testing.T) {
	fake := &fakeDB{
		getCollectionFormByIDFn: func(ctx context.Context, id int64) (db.CollectionForm, error) {
			return db.CollectionForm{ID: id, CollectionID: 10}, nil
		},
		getCollectionFn: func(ctx context.Context, id int64) (db.Collection, error) {
			return db.Collection{ID: id, GroupID: 7}, nil
		},
		getGroupByIDFn: func(ctx context.Context, id int64) (db.Group, error) {
			return db.Group{ID: id, OwnerID: 999}, nil
		},
		listGroupMembershipsFn: func(ctx context.Context, groupID int64) ([]db.Membership, error) {
			return []db.Membership{}, nil
		},
	}
	svc := &fakeAuthService{parseAccessTokenFn: func(accessToken string) (int64, error) { return 42, nil }}
	router := newTestRouterWithDeps(svc, fake)

	resp := performAuthJSONRequest(
		router,
		http.MethodPost,
		"/api/forms/5/submissions",
		map[string]any{"collection_id": 10, "answers": []any{}},
		"valid-access",
	)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", resp.Code, resp.Body.String())
	}
}
