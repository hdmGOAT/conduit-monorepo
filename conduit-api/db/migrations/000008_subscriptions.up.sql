CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'growth', 'enterprise');

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

CREATE INDEX idx_organization_subscriptions_group_id ON organization_subscriptions(group_id);
CREATE INDEX idx_subscription_usage_periods_group_period ON subscription_usage_periods(group_id, period_start);
