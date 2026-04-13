DROP INDEX IF EXISTS idx_outbox_status_created_at;
DROP INDEX IF EXISTS idx_payments_collection_id;
DROP INDEX IF EXISTS idx_payments_user_id;
DROP INDEX IF EXISTS idx_collections_group_id;
DROP INDEX IF EXISTS idx_memberships_group_id;
DROP INDEX IF EXISTS idx_groups_owner_id;

DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS cash_payments;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS collections;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS outbox_status;
DROP TYPE IF EXISTS cash_payment_status;
DROP TYPE IF EXISTS payment_method;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS collection_status;
DROP TYPE IF EXISTS membership_role;
