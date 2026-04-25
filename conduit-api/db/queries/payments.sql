-- name: CreatePayment :one
INSERT INTO payments (user_id, collection_id, base_amount, fee_amount, total_amount, method, stripe_payment_intent_id)
VALUES ($1, $2, $3, $4, $5, $6::payment_method, $7)
RETURNING *;

-- name: CreateCashPayment :one
INSERT INTO cash_payments (payment_id)
VALUES ($1)
RETURNING *;

-- name: GetPaymentByID :one
SELECT *
FROM payments
WHERE id = $1
LIMIT 1;

-- name: GetCashPaymentByPaymentID :one
SELECT *
FROM cash_payments
WHERE payment_id = $1
LIMIT 1;

-- name: ConfirmCashPayment :one
UPDATE cash_payments
SET status = 'confirmed',
	confirmed_by = sqlc.arg(confirmed_by)::bigint,
	confirmed_at = NOW()
WHERE payment_id = sqlc.arg(payment_id)
	AND status = 'pending'
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
