-- name: CreateGroup :one
INSERT INTO groups (owner_id, name, is_open)
VALUES ($1, $2, $3)
RETURNING *;

-- name: AddMembership :one
INSERT INTO memberships (user_id, group_id, role)
VALUES ($1, $2, $3::membership_role)
RETURNING *;

-- name: UpdateMembership :one
UPDATE memberships
SET role = $3::membership_role
WHERE user_id = $1 AND group_id = $2
RETURNING *;

-- name: ListGroupMemberships :many
SELECT *
FROM memberships
WHERE group_id = $1
ORDER BY user_id;

-- name: ListGroupsByOwner :many
SELECT *
FROM groups
WHERE owner_id = $1
ORDER BY id DESC;

-- name: GetGroupByID :one
SELECT *
FROM groups
WHERE id = $1;

-- name: CreateJoinRequest :one
INSERT INTO join_requests (user_id, group_id, status)
VALUES ($1, $2, $3::join_request_status)
RETURNING *;

-- name: ListJoinRequestsByGroup :many
SELECT *
FROM join_requests
WHERE group_id = $1
ORDER BY created_at DESC;

-- name: UpdateJoinRequestStatus :one
UPDATE join_requests
SET status = $3::join_request_status
WHERE user_id = $1 AND group_id = $2
RETURNING *;

-- name: UpdateGroupIsOpen :one
UPDATE groups
SET is_open = $2
WHERE id = $1
RETURNING *;

-- name: DeleteMembership :one
DELETE FROM memberships
WHERE user_id = $1 AND group_id = $2
RETURNING *;

-- name: UpdateGroup :one
UPDATE groups
SET name = $2
WHERE id = $1
RETURNING *;

-- name: DeleteGroup :one
DELETE FROM groups
WHERE id = $1
RETURNING *;
