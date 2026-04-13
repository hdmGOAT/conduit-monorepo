-- name: CreateGroup :one
INSERT INTO groups (owner_id, name)
VALUES ($1, $2)
RETURNING *;

-- name: AddMembership :one
INSERT INTO memberships (user_id, group_id, role)
VALUES ($1, $2, $3::membership_role)
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
