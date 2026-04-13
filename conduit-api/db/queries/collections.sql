-- name: CreateCollection :one
INSERT INTO collections (group_id, amount, deadline)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListCollectionsByGroup :many
SELECT *
FROM collections
WHERE group_id = $1
ORDER BY id DESC;

-- name: CloseCollection :one
UPDATE collections
SET status = 'closed'
WHERE id = $1
RETURNING *;
