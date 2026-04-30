DROP INDEX IF EXISTS idx_subscription_usage_periods_group_period;
DROP INDEX IF EXISTS idx_organization_subscriptions_group_id;

DROP TABLE IF EXISTS subscription_usage_periods;
DROP TABLE IF EXISTS organization_subscriptions;

DROP TYPE IF EXISTS subscription_tier;
