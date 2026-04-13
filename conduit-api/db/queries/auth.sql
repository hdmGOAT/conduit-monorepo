-- name: CreateUserCredential :one
INSERT INTO users (email, password_hash, display_name, pfp_url)
VALUES ($1, $2, $3, $4)
RETURNING id, email, password_hash, display_name, pfp_url, created_at;

-- name: GetUserCredentialByEmail :one
SELECT id, email, password_hash, display_name, pfp_url, created_at
FROM users
WHERE email = $1;

-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (user_id, token_id, expires_at)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetRefreshTokenByTokenID :one
SELECT *
FROM refresh_tokens
WHERE token_id = $1;

-- name: RevokeRefreshToken :exec
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE token_id = $1 AND revoked_at IS NULL;

-- name: RevokeRefreshTokensForUser :exec
UPDATE refresh_tokens
SET revoked_at = NOW()
WHERE user_id = $1 AND revoked_at IS NULL;
