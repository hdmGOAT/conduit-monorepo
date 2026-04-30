-- name: CreateCollection :one
INSERT INTO collections (group_id, amount, deadline)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListCollectionsByGroup :many
SELECT *
FROM collections
WHERE group_id = $1
ORDER BY id DESC;

-- name: GetCollection :one
SELECT *
FROM collections
WHERE id = $1;

-- name: CloseCollection :one
UPDATE collections
SET status = 'closed'
WHERE id = $1 AND group_id = $2
RETURNING *;

-- name: UpdateCollection :one
UPDATE collections
SET amount = $2, deadline = $3
WHERE id = $1 AND group_id = $4
RETURNING *;

-- name: DeleteCollection :one
DELETE FROM collections
WHERE id = $1 AND group_id = $2
RETURNING *;
