package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrEmailAlreadyExists  = errors.New("email already exists")
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
	ErrUserNotFound        = errors.New("user not found")
)

type Session struct {
	AccessToken  string
	RefreshToken string
	TokenType    string
	ExpiresIn    int
}

type Service struct {
	queries *db.Queries
	tokens  *TokenManager
}

func NewService(queries *db.Queries, tokens *TokenManager) *Service {
	return &Service{queries: queries, tokens: tokens}
}

func (s *Service) Register(ctx context.Context, email, password, displayName string) (Session, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return Session{}, err
	}

	normalizedEmail := normalizeEmail(email)
	normalizedDisplayName := strings.TrimSpace(displayName)
	if normalizedDisplayName == "" {
		normalizedDisplayName = normalizedEmail
	}

	user, err := s.queries.CreateUserCredential(ctx, db.CreateUserCredentialParams{
		Email:        normalizedEmail,
		PasswordHash: string(hash),
		DisplayName:  normalizedDisplayName,
		PfpUrl:       pgtype.Text{},
	})
	if err != nil {
		if isUniqueViolation(err) {
			return Session{}, ErrEmailAlreadyExists
		}
		return Session{}, err
	}

	return s.createSession(ctx, user.ID)
}

func (s *Service) Login(ctx context.Context, email, password string) (Session, error) {
	user, err := s.queries.GetUserCredentialByEmail(ctx, normalizeEmail(email))
	if err != nil {
		return Session{}, ErrInvalidCredentials
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return Session{}, ErrInvalidCredentials
	}

	return s.createSession(ctx, user.ID)
}

func (s *Service) Refresh(ctx context.Context, refreshToken string) (Session, error) {
	userID, tokenID, err := s.tokens.ParseRefreshToken(refreshToken)
	if err != nil {
		return Session{}, ErrInvalidRefreshToken
	}

	stored, err := s.queries.GetRefreshTokenByTokenID(ctx, tokenID)
	if err != nil {
		return Session{}, ErrInvalidRefreshToken
	}

	if stored.RevokedAt.Valid || !stored.ExpiresAt.Valid || stored.ExpiresAt.Time.Before(time.Now()) {
		return Session{}, ErrInvalidRefreshToken
	}

	if err := s.queries.RevokeRefreshToken(ctx, tokenID); err != nil {
		return Session{}, err
	}

	return s.createSession(ctx, userID)
}

func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	if strings.TrimSpace(refreshToken) == "" {
		return nil
	}

	_, tokenID, err := s.tokens.ParseRefreshToken(refreshToken)
	if err != nil {
		return nil
	}

	return s.queries.RevokeRefreshToken(ctx, tokenID)
}

func (s *Service) ParseAccessToken(accessToken string) (int64, error) {
	return s.tokens.ParseAccessToken(accessToken)
}

func (s *Service) GetUser(ctx context.Context, userID int64) (db.User, error) {
	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		return db.User{}, ErrUserNotFound
	}
	return user, nil
}

func (s *Service) createSession(ctx context.Context, userID int64) (Session, error) {
	accessToken, err := s.tokens.CreateAccessToken(userID)
	if err != nil {
		return Session{}, err
	}

	refreshToken, refreshTokenID, refreshExpiresAt, err := s.tokens.CreateRefreshToken(userID)
	if err != nil {
		return Session{}, err
	}

	_, err = s.queries.CreateRefreshToken(ctx, db.CreateRefreshTokenParams{
		UserID:  userID,
		TokenID: refreshTokenID,
		ExpiresAt: pgtype.Timestamptz{
			Time:  refreshExpiresAt,
			Valid: true,
		},
	})
	if err != nil {
		return Session{}, err
	}

	return Session{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    s.tokens.AccessTTLSeconds(),
	}, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
