package main

import (
	"context"
	"log"

	"conduit-monorepo/conduit-api/app/api"
	"conduit-monorepo/conduit-api/app/auth"
	"conduit-monorepo/conduit-api/app/config"
	"conduit-monorepo/conduit-api/app/email"
	"conduit-monorepo/conduit-api/internal/db"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	cfg := config.Load()

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect db: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("failed to ping db: %v", err)
	}

	queries := db.New(pool)
	tokenManager := auth.NewTokenManager(cfg.JWTSecret, cfg.AccessTTL, cfg.RefreshTTL)
	resetEmailSender := email.NewResendSender(cfg.ResendAPIKey, cfg.ResendFromEmail)
	authService := auth.NewService(queries, tokenManager, resetEmailSender, cfg.FrontendURL, cfg.PasswordResetTTL)
	authHandler := api.NewAuthHandler(authService, cfg.CookieSecure, tokenManager.RefreshTTLSeconds())
	groupsHandler := api.NewGroupsHandler(queries)
	collectionsHandler := api.NewCollectionsHandler(queries)
	stripeGateway := api.NewStripeGateway(cfg.StripeSecretKey, cfg.StripeWebhookSecret, cfg.StripeCurrency)
	paymentsHandler := api.NewPaymentsHandler(queries, stripeGateway)
	formsHandler := api.NewFormsHandler(queries)
	router := api.NewRouter(authHandler, groupsHandler, collectionsHandler, paymentsHandler, formsHandler, authService)

	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
