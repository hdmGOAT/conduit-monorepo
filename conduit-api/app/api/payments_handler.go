package api

import (
	"context"
	"errors"
	"log"
	"net/http"
	"strconv"

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
		"amount":                   payment.Amount,
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

		stripeIntent, err = h.stripe.CreatePaymentIntent(c.Request.Context(), collection.Amount, map[string]string{
			"collection_id": strconv.FormatInt(collection.ID, 10),
			"user_id":       strconv.FormatInt(callerID, 10),
			"amount":        strconv.FormatInt(collection.Amount, 10),
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

	payment, err := h.db.CreatePayment(c.Request.Context(), db.CreatePaymentParams{
		UserID:                callerID,
		CollectionID:          collection.ID,
		Amount:                collection.Amount,
		Column4:               method,
		StripePaymentIntentID: stripePaymentIntentID,
	})
	if err != nil {
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

		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid stripe webhook"})
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

	payments, err := h.db.ListPaymentsByCollection(c.Request.Context(), collection.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list payments"})
		return
	}

	out := make([]gin.H, 0, len(payments))
	for _, payment := range payments {
		out = append(out, paymentResponse(payment, nil))
	}

	c.JSON(http.StatusOK, out)
}
