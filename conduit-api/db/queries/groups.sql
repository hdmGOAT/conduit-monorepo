-- name: CreateGroup :one
INSERT INTO groups (owner_id, name, is_open)
VALUES ($1, $2, $3)
RETURNING *;

-- name: AddMembership :one
WITH params AS (
	SELECT $1::bigint AS user_id,
				 $2::bigint AS group_id,
				 $3::membership_role AS role
)
INSERT INTO memberships (user_id, group_id, role)
SELECT params.user_id, params.group_id, params.role FROM params
ON CONFLICT (user_id, group_id) DO UPDATE SET role = EXCLUDED.role
RETURNING *;

-- name: UpdateMembership :one
WITH params AS (
	SELECT $1::bigint AS user_id,
				 $2::bigint AS group_id,
				 $3::membership_role AS role
)
UPDATE memberships
SET role = params.role
FROM params
WHERE user_id = params.user_id AND group_id = params.group_id
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
WITH params AS (
	SELECT $1::bigint AS user_id,
				 $2::bigint AS group_id,
				 $3::join_request_status AS status
)
INSERT INTO join_requests (user_id, group_id, status)
SELECT params.user_id, params.group_id, params.status FROM params
RETURNING *;

-- name: ListJoinRequestsByGroup :many
SELECT *
FROM join_requests
WHERE group_id = $1
ORDER BY created_at DESC;

-- name: UpdateJoinRequestStatus :one
WITH params AS (
	SELECT $1::bigint AS user_id,
				 $2::bigint AS group_id,
				 $3::join_request_status AS status
)
UPDATE join_requests
SET status = params.status
FROM params
WHERE user_id = params.user_id AND group_id = params.group_id
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
