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

-- name: UpdateCollection :one
UPDATE collections
SET amount = $2, deadline = $3
WHERE id = $1
RETURNING *;

-- name: DeleteCollection :one
DELETE FROM collections
WHERE id = $1
RETURNING *;
