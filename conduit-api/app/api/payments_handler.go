package api

import (
	"context"
	"net/http"
	"strconv"

	"conduit-monorepo/conduit-api/internal/db"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
)

type PaymentsHandler struct {
	db db.Querier
}

func NewPaymentsHandler(dbq db.Querier) *PaymentsHandler {
	return &PaymentsHandler{db: dbq}
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

func paymentResponse(payment db.Payment) gin.H {
	return gin.H{
		"id":                       payment.ID,
		"user_id":                  payment.UserID,
		"collection_id":            payment.CollectionID,
		"amount":                   payment.Amount,
		"status":                   payment.Status,
		"method":                   payment.Method,
		"stripe_payment_intent_id": textToInterface(payment.StripePaymentIntentID),
		"created_at":               timeToInterface(payment.CreatedAt),
	}
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

	payment, err := h.db.CreatePayment(c.Request.Context(), db.CreatePaymentParams{
		UserID:                callerID,
		CollectionID:          collection.ID,
		Amount:                collection.Amount,
		Column4:               db.PaymentMethod(req.Method),
		StripePaymentIntentID: pgtype.Text{},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create payment"})
		return
	}

	c.JSON(http.StatusOK, paymentResponse(payment))
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
		out = append(out, paymentResponse(payment))
	}

	c.JSON(http.StatusOK, out)
}
