-- Revert join requests table and is_open flag

DROP INDEX IF EXISTS idx_join_requests_group_id;
DROP TABLE IF EXISTS join_requests;
ALTER TABLE groups DROP COLUMN IF EXISTS is_open;
DROP TYPE IF EXISTS join_request_status;
