package api

import "conduit-monorepo/conduit-api/internal/db"

type billingPlan struct {
	Tier                         db.SubscriptionTier
	Name                         string
	MonthlyPriceCents            int64
	MemberLimit                  int32
	TransactionCapacityPerPeriod int32
	TransactionFeeBps            int32
	StripePriceID                string
}

type billingPlanCatalog map[db.SubscriptionTier]billingPlan

func DefaultBillingPlanCatalog() billingPlanCatalog {
	return billingPlanCatalog{
		db.SubscriptionTierFree: {
			Tier:                         db.SubscriptionTierFree,
			Name:                         "Free",
			MonthlyPriceCents:            0,
			MemberLimit:                  25,
			TransactionCapacityPerPeriod: 250,
			TransactionFeeBps:            50,
		},
		db.SubscriptionTierStarter: {
			Tier:                         db.SubscriptionTierStarter,
			Name:                         "Starter",
			MonthlyPriceCents:            15000,
			MemberLimit:                  100,
			TransactionCapacityPerPeriod: 2500,
			TransactionFeeBps:            25,
		},
		db.SubscriptionTierGrowth: {
			Tier:                         db.SubscriptionTierGrowth,
			Name:                         "Growth",
			MonthlyPriceCents:            50000,
			MemberLimit:                  500,
			TransactionCapacityPerPeriod: 15000,
			TransactionFeeBps:            10,
		},
		db.SubscriptionTierEnterprise: {
			Tier:                         db.SubscriptionTierEnterprise,
			Name:                         "Enterprise",
			MonthlyPriceCents:            150000,
			MemberLimit:                  5000,
			TransactionCapacityPerPeriod: 120000,
			TransactionFeeBps:            0,
		},
	}
}

func (c billingPlanCatalog) WithStripePrices(starter, growth, enterprise string) billingPlanCatalog {
	next := DefaultBillingPlanCatalog()
	for tier, plan := range c {
		next[tier] = plan
	}

	starterPlan := next[db.SubscriptionTierStarter]
	starterPlan.StripePriceID = starter
	next[db.SubscriptionTierStarter] = starterPlan

	growthPlan := next[db.SubscriptionTierGrowth]
	growthPlan.StripePriceID = growth
	next[db.SubscriptionTierGrowth] = growthPlan

	enterprisePlan := next[db.SubscriptionTierEnterprise]
	enterprisePlan.StripePriceID = enterprise
	next[db.SubscriptionTierEnterprise] = enterprisePlan

	return next
}
