# Subscription Model: Database Design Notes

## Goal

Define DB structures, migration plan, and SQL query surface for tiered subscription enforcement.

## Proposed Schema Additions

## 1. Enum for Tier

```sql
CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'growth', 'enterprise');
```

## 2. Organization Subscription Table

One row per group (group == organization in current domain model).

```sql
CREATE TABLE organization_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
    tier subscription_tier NOT NULL DEFAULT 'free',
    member_limit INTEGER NOT NULL,
    transaction_capacity_per_period INTEGER NOT NULL,
    transaction_fee_bps INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organization_subscriptions_group_id ON organization_subscriptions(group_id);
```

Notes:

- `transaction_fee_bps` uses basis points. Example: `50` = 0.50%.
- For paid tiers, fee can be `0` if desired.

## 3. Usage by Billing Period

Track transaction usage and fee totals per organization per period.

```sql
CREATE TABLE subscription_usage_periods (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    gross_amount BIGINT NOT NULL DEFAULT 0,
    fee_amount BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, period_start)
);

CREATE INDEX idx_subscription_usage_periods_group_period ON subscription_usage_periods(group_id, period_start);
```

Notes:

- `transaction_count` increments on successful payment creation (or confirmed payment, based on business rule).
- `gross_amount` stores total payment base amount in cents.
- `fee_amount` stores total fee amount in cents.

## Optional Schema Addition (Audit)

If tier changes should be auditable:

```sql
CREATE TABLE subscription_tier_changes (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    old_tier subscription_tier NOT NULL,
    new_tier subscription_tier NOT NULL,
    changed_by BIGINT REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Migration Plan

Recommended migration files:

- `000006_subscriptions.up.sql`
- `000006_subscriptions.down.sql`

Up migration sequence:

1. Create `subscription_tier` enum.
2. Create `organization_subscriptions`.
3. Create `subscription_usage_periods`.
4. Backfill existing groups with free-tier defaults.
5. Create indexes.

Down migration sequence:

1. Drop indexes.
2. Drop `subscription_usage_periods`.
3. Drop `organization_subscriptions`.
4. Drop `subscription_tier` enum.

## Backfill Strategy

Initialize one subscription row for each existing group:

```sql
INSERT INTO organization_subscriptions (
    group_id,
    tier,
    member_limit,
    transaction_capacity_per_period,
    transaction_fee_bps
)
SELECT
    g.id,
    'free'::subscription_tier,
    25,
    250,
    50
FROM groups g
ON CONFLICT (group_id) DO NOTHING;
```

Note: use product-approved defaults before executing in production.

## Fee Formula

Use deterministic integer math at service level:

- `fee_cents = ceil(base_amount_cents * transaction_fee_bps / 10000)`
- `total_cents = base_amount_cents + fee_cents`

If needed, store both base and fee amounts in `payments` for auditability:

```sql
ALTER TABLE payments
    ADD COLUMN base_amount BIGINT,
    ADD COLUMN fee_amount BIGINT NOT NULL DEFAULT 0;
```

## SQLC Query Surface (Suggested)

Add new query files (for example `db/queries/subscriptions.sql`):

- `GetOrganizationSubscriptionByGroup`
- `UpsertOrganizationSubscription`
- `GetUsagePeriodByGroupAndStart`
- `CreateUsagePeriod`
- `IncrementUsageForPayment`
- `CountMembersByGroup`

Example for member counting:

```sql
-- name: CountMembersByGroup :one
SELECT COUNT(*)::BIGINT
FROM memberships
WHERE group_id = $1;
```

## Transaction Safety

Policy checks and writes should be in one DB transaction.

Payment creation flow should:

1. Lock subscription row (`SELECT ... FOR UPDATE`).
2. Lock current usage row (`SELECT ... FOR UPDATE`) or create it.
3. Validate capacity.
4. Insert payment.
5. Increment usage counters.
6. Commit.

This prevents race conditions when multiple payments are created concurrently.

## Open Decisions

- Whether capacity counts all payment attempts or only successful payments.
- Exact period boundaries (calendar month in org timezone vs UTC month).
- Whether fee applies to cash payments, Stripe payments, or both.
- Whether tier definitions are static config or data-driven plan catalog.
