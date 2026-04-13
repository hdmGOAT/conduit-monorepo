package auth

import (
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	TokenTypeAccess  = "access"
	TokenTypeRefresh = "refresh"
)

type tokenClaims struct {
	TokenType string `json:"typ"`
	jwt.RegisteredClaims
}

type TokenManager struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

func NewTokenManager(secret string, accessTTL, refreshTTL time.Duration) *TokenManager {
	return &TokenManager{secret: []byte(secret), accessTTL: accessTTL, refreshTTL: refreshTTL}
}

func (tm *TokenManager) AccessTTLSeconds() int {
	return int(tm.accessTTL.Seconds())
}

func (tm *TokenManager) RefreshTTLSeconds() int {
	return int(tm.refreshTTL.Seconds())
}

func (tm *TokenManager) CreateAccessToken(userID int64) (string, error) {
	return tm.createToken(userID, TokenTypeAccess, tm.accessTTL, "")
}

func (tm *TokenManager) CreateRefreshToken(userID int64) (string, string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(tm.refreshTTL)
	tokenID := strconv.FormatInt(now.UnixNano(), 36) + "-" + strconv.FormatInt(userID, 36)
	token, err := tm.createToken(userID, TokenTypeRefresh, tm.refreshTTL, tokenID)
	if err != nil {
		return "", "", time.Time{}, err
	}
	return token, tokenID, expiresAt, nil
}

func (tm *TokenManager) ParseAccessToken(raw string) (int64, error) {
	userID, _, err := tm.parse(raw, TokenTypeAccess)
	return userID, err
}

func (tm *TokenManager) ParseRefreshToken(raw string) (int64, string, error) {
	return tm.parse(raw, TokenTypeRefresh)
}

func (tm *TokenManager) createToken(userID int64, tokenType string, ttl time.Duration, tokenID string) (string, error) {
	now := time.Now()
	claims := tokenClaims{
		TokenType: tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        tokenID,
			Subject:   strconv.FormatInt(userID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(tm.secret)
}

func (tm *TokenManager) parse(rawToken, expectedType string) (int64, string, error) {
	claims := &tokenClaims{}
	parsed, err := jwt.ParseWithClaims(rawToken, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return tm.secret, nil
	})
	if err != nil || !parsed.Valid {
		return 0, "", errors.New("invalid token")
	}
	if claims.TokenType != expectedType {
		return 0, "", errors.New("invalid token type")
	}

	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil {
		return 0, "", errors.New("invalid subject")
	}

	return userID, claims.ID, nil
}
