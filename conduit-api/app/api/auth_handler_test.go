package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"conduit-monorepo/conduit-api/app/auth"
	"conduit-monorepo/conduit-api/internal/db"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
)

type meResponse struct {
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	PFPURL      string `json:"pfp_url"`
}

type validationErrorResponse struct {
	Error   string `json:"error"`
	Details []struct {
		Field   string `json:"field"`
		Message string `json:"message"`
	} `json:"details"`
}

type fakeAuthService struct {
	registerFn         func(ctx context.Context, email, password, displayName string) (auth.Session, error)
	loginFn            func(ctx context.Context, email, password string) (auth.Session, error)
	refreshFn          func(ctx context.Context, refreshToken string) (auth.Session, error)
	logoutFn           func(ctx context.Context, refreshToken string) error
	getUserFn          func(ctx context.Context, userID int64) (db.User, error)
	parseAccessTokenFn func(accessToken string) (int64, error)
}

func (f *fakeAuthService) Register(ctx context.Context, email, password, displayName string) (auth.Session, error) {
	return f.registerFn(ctx, email, password, displayName)
}

func (f *fakeAuthService) Login(ctx context.Context, email, password string) (auth.Session, error) {
	return f.loginFn(ctx, email, password)
}

func (f *fakeAuthService) Refresh(ctx context.Context, refreshToken string) (auth.Session, error) {
	return f.refreshFn(ctx, refreshToken)
}

func (f *fakeAuthService) Logout(ctx context.Context, refreshToken string) error {
	if f.logoutFn == nil {
		return nil
	}
	return f.logoutFn(ctx, refreshToken)
}

func (f *fakeAuthService) GetUser(ctx context.Context, userID int64) (db.User, error) {
	return f.getUserFn(ctx, userID)
}

func (f *fakeAuthService) ParseAccessToken(accessToken string) (int64, error) {
	return f.parseAccessTokenFn(accessToken)
}

func TestAuthRegisterSuccess(t *testing.T) {
	router := newTestRouter(&fakeAuthService{
		registerFn: func(ctx context.Context, email, password, displayName string) (auth.Session, error) {
			return auth.Session{AccessToken: "a", RefreshToken: "r", TokenType: "Bearer", ExpiresIn: 900}, nil
		},
		loginFn:            failLogin,
		refreshFn:          failRefresh,
		getUserFn:          failGetUser,
		parseAccessTokenFn: failParseToken,
	})

	resp := performJSONRequest(router, http.MethodPost, "/api/auth/register", map[string]string{
		"email":        "user@example.com",
		"password":     "password123",
		"display_name": "User",
	})

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	if got := resp.Header().Get("Set-Cookie"); got == "" {
		t.Fatal("expected refresh cookie to be set")
	}
}

func TestAuthRegisterConflict(t *testing.T) {
	router := newTestRouter(&fakeAuthService{
		registerFn: func(ctx context.Context, email, password, displayName string) (auth.Session, error) {
			return auth.Session{}, auth.ErrEmailAlreadyExists
		},
		loginFn:            failLogin,
		refreshFn:          failRefresh,
		getUserFn:          failGetUser,
		parseAccessTokenFn: failParseToken,
	})

	resp := performJSONRequest(router, http.MethodPost, "/api/auth/register", map[string]string{
		"email":        "user@example.com",
		"password":     "password123",
		"display_name": "User",
	})

	if resp.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", resp.Code)
	}
}

func TestAuthRegisterMissingDisplayName(t *testing.T) {
	router := newTestRouter(defaultFakeService())

	resp := performJSONRequest(router, http.MethodPost, "/api/auth/register", map[string]string{
		"email":    "user@example.com",
		"password": "password123",
	})

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}

	var payload validationErrorResponse
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if len(payload.Details) == 0 || payload.Details[0].Field != "display_name" {
		t.Fatalf("expected display_name field error, got %#v", payload.Details)
	}
}

func TestAuthLoginInvalidCredentials(t *testing.T) {
	router := newTestRouter(&fakeAuthService{
		registerFn: failRegister,
		loginFn: func(ctx context.Context, email, password string) (auth.Session, error) {
			return auth.Session{}, auth.ErrInvalidCredentials
		},
		refreshFn:          failRefresh,
		getUserFn:          failGetUser,
		parseAccessTokenFn: failParseToken,
	})

	resp := performJSONRequest(router, http.MethodPost, "/api/auth/login", map[string]string{
		"email":    "user@example.com",
		"password": "wrongpass",
	})

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestAuthRefreshMissingToken(t *testing.T) {
	router := newTestRouter(defaultFakeService())

	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestAuthRefreshSuccess(t *testing.T) {
	router := newTestRouter(&fakeAuthService{
		registerFn: failRegister,
		loginFn:    failLogin,
		refreshFn: func(ctx context.Context, refreshToken string) (auth.Session, error) {
			if refreshToken != "valid-refresh" {
				return auth.Session{}, auth.ErrInvalidRefreshToken
			}
			return auth.Session{AccessToken: "new-a", RefreshToken: "new-r", TokenType: "Bearer", ExpiresIn: 900}, nil
		},
		getUserFn:          failGetUser,
		parseAccessTokenFn: failParseToken,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	req.Header.Set("X-Refresh-Token", "valid-refresh")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
}

func TestAuthMeUnauthorizedWithoutBearer(t *testing.T) {
	router := newTestRouter(defaultFakeService())

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
}

func TestAuthMeSuccess(t *testing.T) {
	router := newTestRouter(&fakeAuthService{
		registerFn: failRegister,
		loginFn:    failLogin,
		refreshFn:  failRefresh,
		getUserFn: func(ctx context.Context, userID int64) (db.User, error) {
			if userID != 42 {
				return db.User{}, auth.ErrUserNotFound
			}
			return db.User{ID: 42, Email: "user@example.com", DisplayName: "User", PfpUrl: pgtype.Text{String: "https://cdn.example.com/u.png", Valid: true}}, nil
		},
		parseAccessTokenFn: func(accessToken string) (int64, error) {
			if accessToken != "valid-access" {
				return 0, errors.New("bad token")
			}
			return 42, nil
		},
	})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer valid-access")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}

	var payload meResponse
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if payload.DisplayName != "User" {
		t.Fatalf("expected display_name User, got %q", payload.DisplayName)
	}
	if payload.PFPURL != "https://cdn.example.com/u.png" {
		t.Fatalf("expected pfp_url to match, got %q", payload.PFPURL)
	}
}

func TestAuthLogoutSuccess(t *testing.T) {
	called := false
	router := newTestRouter(&fakeAuthService{
		registerFn: failRegister,
		loginFn:    failLogin,
		refreshFn:  failRefresh,
		getUserFn:  failGetUser,
		logoutFn: func(ctx context.Context, refreshToken string) error {
			called = true
			return nil
		},
		parseAccessTokenFn: failParseToken,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req.Header.Set("X-Refresh-Token", "valid-refresh")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	if !called {
		t.Fatal("expected logout service to be called")
	}
}

func defaultFakeService() *fakeAuthService {
	return &fakeAuthService{
		registerFn:         failRegister,
		loginFn:            failLogin,
		refreshFn:          failRefresh,
		getUserFn:          failGetUser,
		parseAccessTokenFn: failParseToken,
	}
}

func failRegister(ctx context.Context, email, password, displayName string) (auth.Session, error) {
	return auth.Session{}, errors.New("unexpected register call")
}

func failLogin(ctx context.Context, email, password string) (auth.Session, error) {
	return auth.Session{}, errors.New("unexpected login call")
}

func failRefresh(ctx context.Context, refreshToken string) (auth.Session, error) {
	return auth.Session{}, errors.New("unexpected refresh call")
}

func failGetUser(ctx context.Context, userID int64) (db.User, error) {
	return db.User{}, errors.New("unexpected get user call")
}

func failParseToken(accessToken string) (int64, error) {
	return 0, errors.New("unexpected parse token call")
}

func newTestRouter(service AuthService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	handler := NewAuthHandler(service, false, 3600)
	return NewRouter(handler, service)
}

func performJSONRequest(router *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	payload, err := json.Marshal(body)
	if err != nil {
		panic(err)
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	return resp
}
