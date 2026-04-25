-- name: CreatePayment :one
INSERT INTO payments (user_id, collection_id, amount, method, stripe_payment_intent_id)
VALUES ($1, $2, $3, $4::payment_method, $5)
RETURNING *;

-- name: MarkPaymentPaid :one
UPDATE payments
SET status = 'paid'
WHERE id = $1
	AND status = 'pending'
RETURNING *;

-- name: MarkPaymentFailed :one
UPDATE payments
SET status = 'failed'
WHERE id = $1
	AND status = 'pending'
RETURNING *;

-- name: ListPaymentsByCollection :many
SELECT *
FROM payments
WHERE collection_id = $1
ORDER BY id DESC;

-- name: GetPaymentByStripePaymentIntentID :one
SELECT *
FROM payments
WHERE stripe_payment_intent_id = sqlc.arg(stripe_payment_intent_id)::text
LIMIT 1;
