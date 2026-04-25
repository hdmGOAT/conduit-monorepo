package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultDBURL          = "postgres://conduit:conduit@localhost:5432/conduit?sslmode=disable"
	defaultJWT            = "dev-change-me"
	defaultStripeCurrency = "usd"
)

type Config struct {
	Port                                            string
	DatabaseURL                                     string
	JWTSecret                                       string
	AccessTTL                                       time.Duration
	RefreshTTL                                      time.Duration
	PasswordResetTTL                                time.Duration
	CookieSecure                                    bool
	FrontendURL                                     string
	ResendAPIKey                                    string
	ResendFromEmail                                 string
	StripeSecretKey                                 string
	StripeWebhookSecret                             string
	StripeCurrency                                  string
	SubscriptionDefaultTier                         string
	SubscriptionDefaultMemberLimit                  int32
	SubscriptionDefaultTransactionCapacityPerPeriod int32
	SubscriptionDefaultTransactionFeeBps            int32
}

func Load() Config {
	return Config{
		Port:                           envOrDefault("PORT", "8080"),
		DatabaseURL:                    envOrDefault("DATABASE_URL", defaultDBURL),
		JWTSecret:                      envOrDefault("JWT_SECRET", defaultJWT),
		AccessTTL:                      time.Duration(envIntOrDefault("ACCESS_TOKEN_TTL_MINUTES", 15)) * time.Minute,
		RefreshTTL:                     time.Duration(envIntOrDefault("REFRESH_TOKEN_TTL_HOURS", 168)) * time.Hour,
		PasswordResetTTL:               time.Duration(envIntOrDefault("PASSWORD_RESET_TTL_MINUTES", 30)) * time.Minute,
		CookieSecure:                   envOrDefault("COOKIE_SECURE", "false") == "true",
		FrontendURL:                    envOrDefault("FRONTEND_URL", "http://localhost:3000"),
		ResendAPIKey:                   envOrDefault("RESEND_API_KEY", ""),
		ResendFromEmail:                envOrDefault("RESEND_FROM_EMAIL", ""),
		StripeSecretKey:                envOrDefault("STRIPE_SECRET_KEY", ""),
		StripeWebhookSecret:            envOrDefault("STRIPE_WEBHOOK_SECRET", ""),
		StripeCurrency:                 envOrDefault("STRIPE_CURRENCY", defaultStripeCurrency),
		SubscriptionDefaultTier:        envOrDefault("SUBSCRIPTION_DEFAULT_TIER", "free"),
		SubscriptionDefaultMemberLimit: int32(envIntOrDefault("SUBSCRIPTION_DEFAULT_MEMBER_LIMIT", 25)),
		SubscriptionDefaultTransactionCapacityPerPeriod: int32(envIntOrDefault("SUBSCRIPTION_DEFAULT_TRANSACTION_CAPACITY_PER_PERIOD", 250)),
		SubscriptionDefaultTransactionFeeBps:            int32(envIntOrDefault("SUBSCRIPTION_DEFAULT_TRANSACTION_FEE_BPS", 50)),
	}
}

func envOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func envIntOrDefault(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}
