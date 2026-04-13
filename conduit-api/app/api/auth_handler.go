package api

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"conduit-monorepo/conduit-api/app/api/middleware"
	"conduit-monorepo/conduit-api/app/auth"
	"conduit-monorepo/conduit-api/internal/db"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService  AuthService
	cookieSecure bool
	refreshTTL   int
}

type AuthService interface {
	Register(ctx context.Context, email, password, displayName string) (auth.Session, error)
	Login(ctx context.Context, email, password string) (auth.Session, error)
	Refresh(ctx context.Context, refreshToken string) (auth.Session, error)
	Logout(ctx context.Context, refreshToken string) error
	GetUser(ctx context.Context, userID int64) (db.User, error)
	ParseAccessToken(accessToken string) (int64, error)
}

type registerRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	DisplayName string `json:"display_name" binding:"required"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

func NewAuthHandler(authService AuthService, cookieSecure bool, refreshTTLSeconds int) *AuthHandler {
	return &AuthHandler{authService: authService, cookieSecure: cookieSecure, refreshTTL: refreshTTLSeconds}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}
	if strings.TrimSpace(req.DisplayName) == "" {
		respondFieldValidationError(c, "display_name", "cannot be blank")
		return
	}

	session, err := h.authService.Register(c.Request.Context(), req.Email, req.Password, req.DisplayName)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrEmailAlreadyExists):
			c.JSON(http.StatusConflict, gin.H{"error": "email already exists"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		}
		return
	}

	h.respondWithSession(c, session)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	session, err := h.authService.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrInvalidCredentials):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to login"})
		}
		return
	}

	h.respondWithSession(c, session)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	refreshToken := c.GetHeader("X-Refresh-Token")
	if refreshToken == "" {
		refreshToken, _ = c.Cookie("refresh_token")
	}
	if refreshToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing refresh token"})
		return
	}

	session, err := h.authService.Refresh(c.Request.Context(), refreshToken)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrInvalidRefreshToken):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "refresh token expired or revoked"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to refresh token"})
		}
		return
	}

	h.respondWithSession(c, session)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	refreshToken := c.GetHeader("X-Refresh-Token")
	if refreshToken == "" {
		refreshToken, _ = c.Cookie("refresh_token")
	}

	_ = h.authService.Logout(c.Request.Context(), refreshToken)
	c.SetCookie("refresh_token", "", -1, "/", "", h.cookieSecure, true)
	c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}

	userID, ok := userIDValue.(int64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	user, err := h.authService.GetUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	var pfpURL any
	if user.PfpUrl.Valid {
		pfpURL = user.PfpUrl.String
	}

	c.JSON(http.StatusOK, gin.H{
		"id":           user.ID,
		"email":        user.Email,
		"display_name": user.DisplayName,
		"pfp_url":      pfpURL,
	})
}

func (h *AuthHandler) respondWithSession(c *gin.Context, session auth.Session) {
	c.SetCookie("refresh_token", session.RefreshToken, h.refreshTTL, "/", "", h.cookieSecure, true)
	c.JSON(http.StatusOK, gin.H{
		"access_token":  session.AccessToken,
		"refresh_token": session.RefreshToken,
		"token_type":    session.TokenType,
		"expires_in":    session.ExpiresIn,
	})
}
