package api

import (
	"context"
	"errors"
	"time"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type transactionRunner interface {
	WithinTx(ctx context.Context, fn func(db.Querier) error) error
}

type transactionalQuerier struct {
	*db.Queries
	pool *pgxpool.Pool
}

func NewTransactionalQuerier(pool *pgxpool.Pool) db.Querier {
	return &transactionalQuerier{Queries: db.New(pool), pool: pool}
}

func (q *transactionalQuerier) WithinTx(ctx context.Context, fn func(db.Querier) error) error {
	tx, err := q.pool.Begin(ctx)
	if err != nil {
		return err
	}

	defer func() {
		_ = tx.Rollback(ctx)
	}()

	if err := fn(q.Queries.WithTx(tx)); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

type subscriptionLimitError struct {
	code        string
	tier        db.SubscriptionTier
	limit       int64
	current     int64
	periodStart *pgtype.Timestamptz
	periodEnd   *pgtype.Timestamptz
}

func (e *subscriptionLimitError) Error() string {
	return "subscription limit reached"
}

func newMemberLimitError(tier db.SubscriptionTier, limit, current int64) error {
	return &subscriptionLimitError{code: "member_limit_reached", tier: tier, limit: limit, current: current}
}

func newTransactionCapacityError(tier db.SubscriptionTier, limit, current int64, periodStart, periodEnd pgtype.Timestamptz) error {
	return &subscriptionLimitError{
		code:        "transaction_capacity_reached",
		tier:        tier,
		limit:       limit,
		current:     current,
		periodStart: &periodStart,
		periodEnd:   &periodEnd,
	}
}

func respondSubscriptionLimitError(c *gin.Context, err *subscriptionLimitError) {
	body := gin.H{
		"error":   err.Error(),
		"code":    err.code,
		"tier":    err.tier,
		"limit":   err.limit,
		"current": err.current,
	}
	if err.periodStart != nil {
		body["period_start"] = timeToInterface(*err.periodStart)
	}
	if err.periodEnd != nil {
		body["period_end"] = timeToInterface(*err.periodEnd)
	}
	c.JSON(409, body)
}

func runWithinTx(ctx context.Context, q db.Querier, fn func(db.Querier) error) error {
	runner, ok := q.(transactionRunner)
	if !ok {
		return errors.New("transactional database not configured")
	}
	return runner.WithinTx(ctx, fn)
}

func billingPeriodBounds(now time.Time) (pgtype.Timestamptz, pgtype.Timestamptz) {
	start := time.Date(now.UTC().Year(), now.UTC().Month(), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	return pgtype.Timestamptz{Time: start, Valid: true}, pgtype.Timestamptz{Time: end, Valid: true}
}

func calculateFeeAmount(amount int64, feeBps int32) int64 {
	if amount <= 0 || feeBps <= 0 {
		return 0
	}
	return (amount*int64(feeBps) + 9999) / 10000
}
