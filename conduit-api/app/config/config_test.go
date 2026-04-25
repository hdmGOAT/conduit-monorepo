package config

import (
	"testing"
	"time"
)

func TestLoadSubscriptionDefaultsFromEnv(t *testing.T) {
	t.Setenv("SUBSCRIPTION_DEFAULT_TIER", "starter")
	t.Setenv("SUBSCRIPTION_DEFAULT_MEMBER_LIMIT", "42")
	t.Setenv("SUBSCRIPTION_DEFAULT_TRANSACTION_CAPACITY_PER_PERIOD", "900")
	t.Setenv("SUBSCRIPTION_DEFAULT_TRANSACTION_FEE_BPS", "125")

	cfg := Load()

	if cfg.SubscriptionDefaultTier != "starter" {
		t.Fatalf("expected tier starter, got %q", cfg.SubscriptionDefaultTier)
	}
	if cfg.SubscriptionDefaultMemberLimit != 42 {
		t.Fatalf("expected member limit 42, got %d", cfg.SubscriptionDefaultMemberLimit)
	}
	if cfg.SubscriptionDefaultTransactionCapacityPerPeriod != 900 {
		t.Fatalf("expected transaction capacity 900, got %d", cfg.SubscriptionDefaultTransactionCapacityPerPeriod)
	}
	if cfg.SubscriptionDefaultTransactionFeeBps != 125 {
		t.Fatalf("expected fee bps 125, got %d", cfg.SubscriptionDefaultTransactionFeeBps)
	}
}

func TestLoadFallsBackToSubscriptionDefaults(t *testing.T) {
	t.Setenv("SUBSCRIPTION_DEFAULT_TIER", "")
	t.Setenv("SUBSCRIPTION_DEFAULT_MEMBER_LIMIT", "")
	t.Setenv("SUBSCRIPTION_DEFAULT_TRANSACTION_CAPACITY_PER_PERIOD", "")
	t.Setenv("SUBSCRIPTION_DEFAULT_TRANSACTION_FEE_BPS", "")

	cfg := Load()

	if cfg.SubscriptionDefaultTier != "free" {
		t.Fatalf("expected default tier free, got %q", cfg.SubscriptionDefaultTier)
	}
	if cfg.SubscriptionDefaultMemberLimit != 25 {
		t.Fatalf("expected default member limit 25, got %d", cfg.SubscriptionDefaultMemberLimit)
	}
	if cfg.SubscriptionDefaultTransactionCapacityPerPeriod != 250 {
		t.Fatalf("expected default transaction capacity 250, got %d", cfg.SubscriptionDefaultTransactionCapacityPerPeriod)
	}
	if cfg.SubscriptionDefaultTransactionFeeBps != 50 {
		t.Fatalf("expected default fee bps 50, got %d", cfg.SubscriptionDefaultTransactionFeeBps)
	}
}

func TestLoadKeepsExistingDefaults(t *testing.T) {
	t.Setenv("ACCESS_TOKEN_TTL_MINUTES", "")

	cfg := Load()

	if cfg.AccessTTL != 15*time.Minute {
		t.Fatalf("expected access ttl default 15m, got %s", cfg.AccessTTL)
	}
}
