package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultDBURL = "postgres://conduit:conduit@localhost:5432/conduit?sslmode=disable"
	defaultJWT   = "dev-change-me"
)

type Config struct {
	Port         string
	DatabaseURL  string
	JWTSecret    string
	AccessTTL    time.Duration
	RefreshTTL   time.Duration
	CookieSecure bool
}

func Load() Config {
	return Config{
		Port:         envOrDefault("PORT", "8080"),
		DatabaseURL:  envOrDefault("DATABASE_URL", defaultDBURL),
		JWTSecret:    envOrDefault("JWT_SECRET", defaultJWT),
		AccessTTL:    time.Duration(envIntOrDefault("ACCESS_TOKEN_TTL_MINUTES", 15)) * time.Minute,
		RefreshTTL:   time.Duration(envIntOrDefault("REFRESH_TOKEN_TTL_HOURS", 168)) * time.Hour,
		CookieSecure: envOrDefault("COOKIE_SECURE", "false") == "true",
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
