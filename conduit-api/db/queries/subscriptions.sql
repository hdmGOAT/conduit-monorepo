-- name: GetOrganizationSubscriptionByGroup :one
SELECT *
FROM organization_subscriptions
WHERE group_id = $1
LIMIT 1 FOR UPDATE;

-- name: UpsertOrganizationSubscription :one
INSERT INTO organization_subscriptions (
    group_id,
    tier,
    member_limit,
    transaction_capacity_per_period,
    transaction_fee_bps
)
VALUES (
  sqlc.arg(group_id),
  sqlc.arg(tier)::subscription_tier,
  sqlc.arg(member_limit),
  sqlc.arg(transaction_capacity_per_period),
  sqlc.arg(transaction_fee_bps)
)
ON CONFLICT (group_id)
DO UPDATE SET
    tier = EXCLUDED.tier,
    member_limit = EXCLUDED.member_limit,
    transaction_capacity_per_period = EXCLUDED.transaction_capacity_per_period,
    transaction_fee_bps = EXCLUDED.transaction_fee_bps,
    updated_at = NOW()
RETURNING *;

-- name: GetUsagePeriodByGroupAndStart :one
SELECT *
FROM subscription_usage_periods
WHERE group_id = $1
  AND period_start = $2
LIMIT 1 FOR UPDATE;

-- name: CreateUsagePeriod :one
INSERT INTO subscription_usage_periods (
    group_id,
    period_start,
    period_end,
    transaction_count,
    gross_amount,
    fee_amount
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: IncrementUsageForPayment :one
UPDATE subscription_usage_periods
SET transaction_count = transaction_count + $3,
    gross_amount = gross_amount + $4,
    fee_amount = fee_amount + $5,
    updated_at = NOW()
WHERE group_id = $1
  AND period_start = $2
RETURNING *;

-- name: CountMembersByGroup :one
SELECT COUNT(*)::BIGINT
FROM memberships
WHERE group_id = $1;
