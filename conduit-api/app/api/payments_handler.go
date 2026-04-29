package api

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	stripe "github.com/stripe/stripe-go/v84"
)

type PaymentsHandler struct {
	db     db.Querier
	stripe stripeGateway
}

func NewPaymentsHandler(dbq db.Querier, gateways ...stripeGateway) *PaymentsHandler {
	var gateway stripeGateway
	if len(gateways) > 0 {
		gateway = gateways[0]
	}
	return &PaymentsHandler{db: dbq, stripe: gateway}
}

type createPaymentRequest struct {
	Method string `json:"method" binding:"required,oneof=stripe cash"`
}

func (h *PaymentsHandler) getAccessibleCollection(ctx context.Context, callerID, collectionID int64) (db.Collection, bool, error) {
	collection, err := h.db.GetCollection(ctx, collectionID)
	if err != nil {
		return db.Collection{}, false, err
	}

	_, role, err := resolveGroupAccess(ctx, h.db, callerID, collection.GroupID)
	if err != nil {
		return collection, false, err
	}

	return collection, role != "", nil
}

func paymentResponse(payment db.Payment, stripeIntent *stripePaymentIntent) gin.H {
	out := gin.H{
		"id":                       payment.ID,
		"user_id":                  payment.UserID,
		"collection_id":            payment.CollectionID,
		"amount":                   payment.TotalAmount,
		"base_amount":              payment.BaseAmount,
		"fee_amount":               payment.FeeAmount,
		"total_amount":             payment.TotalAmount,
		"status":                   payment.Status,
		"method":                   payment.Method,
		"stripe_payment_intent_id": textToInterface(payment.StripePaymentIntentID),
		"created_at":               timeToInterface(payment.CreatedAt),
	}
	if stripeIntent != nil {
		out["stripe_payment_intent"] = stripeIntent
	}
	return out
}

func cashPaymentResponse(cashPayment db.CashPayment) gin.H {
	return gin.H{
		"id":           cashPayment.ID,
		"payment_id":   cashPayment.PaymentID,
		"status":       cashPayment.Status,
		"confirmed_by": int8ToInterface(cashPayment.ConfirmedBy),
		"created_at":   timeToInterface(cashPayment.CreatedAt),
		"confirmed_at": timeToInterface(cashPayment.ConfirmedAt),
	}
}

func int8ToInterface(v pgtype.Int8) interface{} {
	if !v.Valid {
		return nil
	}
	return v.Int64
}

func failDuplicatePendingPayments(ctx context.Context, q db.Querier, payment db.Payment) error {
	payments, err := q.ListPaymentsByCollection(ctx, payment.CollectionID)
	if err != nil {
		return err
	}

	for _, otherPayment := range payments {
		if otherPayment.ID == payment.ID {
			continue
		}
		if otherPayment.UserID != payment.UserID {
			continue
		}
		if otherPayment.Status != db.PaymentStatusPending {
			continue
		}
		if _, err := q.MarkPaymentFailed(ctx, otherPayment.ID); err != nil {
			return err
		}
	}

	return nil
}

// CreatePayment creates a pending payment for an active collection.
func (h *PaymentsHandler) CreatePayment(c *gin.Context) {
	callerID, ok := userIDFromContext(c)
	if !ok {
		return
	}

	collectionIDStr := c.Param("collection_id")
	collectionID, err := strconv.ParseInt(collectionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid collection id"})
		return
	}

	collection, canAccess, err := h.getAccessibleCollection(c.Request.Context(), callerID, collectionID)
	if err != nil {
		if isNoRowsErr(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify collection access"})
		return
	}
	if !canAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if collection.Status == db.CollectionStatusClosed {
		c.JSON(http.StatusConflict, gin.H{"error": "collection is closed"})
		return
	}

	existingPayments, err := h.db.ListPaymentsByCollection(c.Request.Context(), collection.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to inspect existing payments"})
		return
	}
	for _, existingPayment := range existingPayments {
		if existingPayment.UserID == callerID && existingPayment.Status == db.PaymentStatusPaid {
			c.JSON(http.StatusConflict, gin.H{"error": "payment already completed for this collection"})
			return
		}
	}

	subscription, err := h.db.GetOrganizationSubscriptionByGroup(c.Request.Context(), collection.GroupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load subscription"})
		return
	}

	baseAmount := collection.Amount
	feeAmount := calculateFeeAmount(baseAmount, subscription.TransactionFeeBps)
	totalAmount := baseAmount + feeAmount

	var req createPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	method := db.PaymentMethod(req.Method)
	var stripeIntent *stripePaymentIntent
	if method == db.PaymentMethodStripe {
		if h.stripe == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "stripe payments are not configured"})
			return
		}

		stripeIntent, err = h.stripe.CreatePaymentIntent(c.Request.Context(), totalAmount, map[string]string{
			"collection_id": strconv.FormatInt(collection.ID, 10),
			"user_id":       strconv.FormatInt(callerID, 10),
			"amount":        strconv.FormatInt(totalAmount, 10),
			"base_amount":   strconv.FormatInt(baseAmount, 10),
			"fee_amount":    strconv.FormatInt(feeAmount, 10),
			"total_amount":  strconv.FormatInt(totalAmount, 10),
		})
		if err != nil {
			if errors.Is(err, errStripeNotConfigured) {
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "stripe payments are not configured"})
				return
			}

			log.Printf("failed to create stripe payment intent: method=%s path=%s collection_id=%d user_id=%d err=%v", c.Request.Method, c.Request.URL.Path, collection.ID, callerID, err)
			c.JSON(http.StatusBadGateway, gin.H{"error": "failed to create stripe payment intent"})
			return
		}
	}

	stripePaymentIntentID := pgtype.Text{}
	if stripeIntent != nil && stripeIntent.ID != "" {
		stripePaymentIntentID = pgtype.Text{String: stripeIntent.ID, Valid: true}
	}

	var payment db.Payment
	err = runWithinTx(c.Request.Context(), h.db, func(q db.Querier) error {
		periodStart, periodEnd := billingPeriodBounds(time.Now().UTC())
		usage, err := q.GetUsagePeriodByGroupAndStart(c.Request.Context(), db.GetUsagePeriodByGroupAndStartParams{GroupID: collection.GroupID, PeriodStart: periodStart})
		if err != nil {
			if !isNoRowsErr(err) {
				return err
			}

			usage, err = q.CreateUsagePeriod(c.Request.Context(), db.CreateUsagePeriodParams{
				GroupID:          collection.GroupID,
				PeriodStart:      periodStart,
				PeriodEnd:        periodEnd,
				TransactionCount: 0,
				GrossAmount:      0,
				FeeAmount:        0,
			})
			if err != nil {
				usage, err = q.GetUsagePeriodByGroupAndStart(c.Request.Context(), db.GetUsagePeriodByGroupAndStartParams{GroupID: collection.GroupID, PeriodStart: periodStart})
				if err != nil {
					return err
				}
			}
		}

		if usage.TransactionCount >= subscription.TransactionCapacityPerPeriod {
			return newTransactionCapacityError(subscription.Tier, int64(subscription.TransactionCapacityPerPeriod), int64(usage.TransactionCount), usage.PeriodStart, usage.PeriodEnd)
		}

		payment, err = q.CreatePayment(c.Request.Context(), db.CreatePaymentParams{
			UserID:                callerID,
			CollectionID:          collection.ID,
			BaseAmount:            baseAmount,
			FeeAmount:             feeAmount,
			TotalAmount:           totalAmount,
			Column6:               method,
			StripePaymentIntentID: stripePaymentIntentID,
		})
		if err != nil {
			return err
		}

		if method == db.PaymentMethodCash {
			if _, err := q.CreateCashPayment(c.Request.Context(), payment.ID); err != nil {
				return err
			}
		}

		if err := failDuplicatePendingPayments(c.Request.Context(), q, payment); err != nil {
			return err
		}

		_, err = q.IncrementUsageForPayment(c.Request.Context(), db.IncrementUsageForPaymentParams{
			GroupID:          collection.GroupID,
			PeriodStart:      usage.PeriodStart,
			TransactionCount: 1,
			GrossAmount:      baseAmount,
			FeeAmount:        feeAmount,
		})
		return err
	})
	if err != nil {
		var limitErr *subscriptionLimitError
		if errors.As(err, &limitErr) {
			respondSubscriptionLimitError(c, limitErr)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create payment"})
		return
	}

	c.JSON(http.StatusOK, paymentResponse(payment, stripeIntent))
}

// HandleStripeWebhook processes Stripe payment_intent webhook events.
func (h *PaymentsHandler) HandleStripeWebhook(c *gin.Context) {
	if h.stripe == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "stripe payments are not configured"})
		return
	}

	payload, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read webhook payload"})
		return
	}

	event, err := h.stripe.ParseWebhookEvent(payload, c.GetHeader("Stripe-Signature"))
	if err != nil {
		if errors.Is(err, errStripeNotConfigured) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "stripe payments are not configured"})
			return
		}

		log.Printf("invalid stripe webhook: method=%s path=%s err=%v", c.Request.Method, c.Request.URL.Path, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid stripe webhook", "details": err.Error()})
		return
	}

	if event.PaymentIntentID == "" {
		c.Status(http.StatusOK)
		return
	}

	ctx := c.Request.Context()
	switch event.Type {
	case string(stripe.EventTypePaymentIntentSucceeded):
		payment, err := h.db.GetPaymentByStripePaymentIntentID(ctx, event.PaymentIntentID)
		if err != nil {
			if isNoRowsErr(err) {
				c.Status(http.StatusOK)
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load payment"})
			return
		}
		if _, err := h.db.MarkPaymentPaid(ctx, payment.ID); err != nil {
			if isNoRowsErr(err) {
				c.Status(http.StatusOK)
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark payment paid"})
			return
		}
	case string(stripe.EventTypePaymentIntentPaymentFailed):
		payment, err := h.db.GetPaymentByStripePaymentIntentID(ctx, event.PaymentIntentID)
		if err != nil {
			if isNoRowsErr(err) {
				c.Status(http.StatusOK)
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load payment"})
			return
		}
		if _, err := h.db.MarkPaymentFailed(ctx, payment.ID); err != nil {
			if isNoRowsErr(err) {
				c.Status(http.StatusOK)
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark payment failed"})
			return
		}
	default:
		c.Status(http.StatusOK)
		return
	}

	c.Status(http.StatusOK)
}

// ListPaymentsByCollection returns all payments for a collection.
func (h *PaymentsHandler) ListPaymentsByCollection(c *gin.Context) {
	callerID, ok := userIDFromContext(c)
	if !ok {
		return
	}

	collectionIDStr := c.Param("collection_id")
	collectionID, err := strconv.ParseInt(collectionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid collection id"})
		return
	}

	collection, canAccess, err := h.getAccessibleCollection(c.Request.Context(), callerID, collectionID)
	if err != nil {
		if isNoRowsErr(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify collection access"})
		return
	}
	if !canAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	_, role, err := resolveGroupAccess(c.Request.Context(), h.db, callerID, collection.GroupID)
	if err != nil {
		if isNoRowsErr(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify group access"})
		return
	}

	payments, err := h.db.ListPaymentsByCollection(c.Request.Context(), collection.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list payments"})
		return
	}

	out := make([]gin.H, 0, len(payments))
	for _, payment := range payments {
		if role != db.MembershipRoleAdmin && role != db.MembershipRoleCollector && payment.UserID != callerID {
			continue
		}
		out = append(out, paymentResponse(payment, nil))
	}

	c.JSON(http.StatusOK, out)
}

// ConfirmCashPayment confirms a pending cash payment. Caller must be a collector in the group.
func (h *PaymentsHandler) ConfirmCashPayment(c *gin.Context) {
	callerID, ok := userIDFromContext(c)
	if !ok {
		return
	}

	paymentID, err := strconv.ParseInt(c.Param("payment_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment id"})
		return
	}

	payment, err := h.db.GetPaymentByID(c.Request.Context(), paymentID)
	if err != nil {
		if isNoRowsErr(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "payment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load payment"})
		return
	}

	if payment.Method != db.PaymentMethodCash {
		c.JSON(http.StatusConflict, gin.H{"error": "payment method is not cash"})
		return
	}

	collection, err := h.db.GetCollection(c.Request.Context(), payment.CollectionID)
	if err != nil {
		if isNoRowsErr(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load payment collection"})
		return
	}

	_, role, err := resolveGroupAccess(c.Request.Context(), h.db, callerID, collection.GroupID)
	if err != nil {
		if isNoRowsErr(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify group access"})
		return
	}
	if role != db.MembershipRoleCollector {
		c.JSON(http.StatusForbidden, gin.H{"error": "collector role required"})
		return
	}

	var confirmedPayment db.Payment
	var confirmedCashPayment db.CashPayment
	err = runWithinTx(c.Request.Context(), h.db, func(q db.Querier) error {
		confirmedPayment, err = q.MarkPaymentPaid(c.Request.Context(), payment.ID)
		if err != nil {
			return err
		}

		confirmedCashPayment, err = q.ConfirmCashPayment(c.Request.Context(), db.ConfirmCashPaymentParams{
			ConfirmedBy: callerID,
			PaymentID:   payment.ID,
		})
		return err
	})
	if err != nil {
		if isNoRowsErr(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "payment is already confirmed or not pending"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to confirm cash payment"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"payment":      paymentResponse(confirmedPayment, nil),
		"cash_payment": cashPaymentResponse(confirmedCashPayment),
	})
}
