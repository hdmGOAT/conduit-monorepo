-- Add join requests table and is_open flag to groups

CREATE TYPE join_request_status AS ENUM ('pending', 'approved', 'denied');

ALTER TABLE groups
ADD COLUMN is_open BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE join_requests (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    status join_request_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

CREATE INDEX idx_join_requests_group_id ON join_requests(group_id);
