package api

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"conduit-monorepo/conduit-api/app/api/middleware"
	"conduit-monorepo/conduit-api/internal/db"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

type CollectionsHandler struct {
	db db.Querier
}

func NewCollectionsHandler(dbq db.Querier) *CollectionsHandler {
	return &CollectionsHandler{db: dbq}
}

func (h *CollectionsHandler) canManageGroup(ctx context.Context, callerID, groupID int64) (bool, error) {
	_, role, err := resolveGroupAccess(ctx, h.db, callerID, groupID)
	if err != nil {
		return false, err
	}
	return role == db.MembershipRoleAdmin, nil
}

type createCollectionRequest struct {
	Amount   int64  `json:"amount" binding:"required"`
	Deadline string `json:"deadline" binding:"required"`
}

type updateCollectionRequest struct {
	Amount   int64  `json:"amount" binding:"required"`
	Deadline string `json:"deadline" binding:"required"`
}

// CreateCollection creates a new collection for a group. Caller must be the owner or an admin.
func (h *CollectionsHandler) CreateCollection(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	callerID, ok := userIDValue.(int64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	canManage, err := h.canManageGroup(c.Request.Context(), callerID, groupID)
	if err != nil {
		if err == sql.ErrNoRows || err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify group access"})
		return
	}
	if !canManage {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be owner or admin to create collection"})
		return
	}

	var req createCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	// parse deadline
	t, err := time.Parse(time.RFC3339, req.Deadline)
	if err != nil {
		respondFieldValidationError(c, "deadline", "must be RFC3339 timestamp")
		return
	}

	coll, err := h.db.CreateCollection(c.Request.Context(), db.CreateCollectionParams{GroupID: groupID, Amount: req.Amount, Deadline: pgtype.Timestamptz{Time: t, Valid: true}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create collection"})
		return
	}

	out := gin.H{"id": coll.ID, "group_id": coll.GroupID, "amount": coll.Amount, "status": coll.Status}
	if coll.Deadline.Valid {
		out["deadline"] = coll.Deadline.Time.UTC().Format(time.RFC3339)
	} else {
		out["deadline"] = nil
	}
	if coll.CreatedAt.Valid {
		out["created_at"] = coll.CreatedAt.Time.UTC().Format(time.RFC3339)
	}

	c.JSON(http.StatusOK, out)
}

// ListCollections lists collections for a group.
func (h *CollectionsHandler) ListCollections(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	cols, err := h.db.ListCollectionsByGroup(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list collections"})
		return
	}

	out := make([]gin.H, 0, len(cols))
	for _, coll := range cols {
		item := gin.H{"id": coll.ID, "group_id": coll.GroupID, "amount": coll.Amount, "status": coll.Status}
		if coll.Deadline.Valid {
			item["deadline"] = coll.Deadline.Time.UTC().Format(time.RFC3339)
		} else {
			item["deadline"] = nil
		}
		if coll.CreatedAt.Valid {
			item["created_at"] = coll.CreatedAt.Time.UTC().Format(time.RFC3339)
		}
		out = append(out, item)
	}

	c.JSON(http.StatusOK, out)
}

// CloseCollection closes an active collection. Caller must be the owner or an admin for the group.
func (h *CollectionsHandler) CloseCollection(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	callerID, ok := userIDValue.(int64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	collIDStr := c.Param("collection_id")
	collID, err := strconv.ParseInt(collIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid collection id"})
		return
	}

	canManage, err := h.canManageGroup(c.Request.Context(), callerID, groupID)
	if err != nil {
		if err == sql.ErrNoRows || err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify group access"})
		return
	}
	if !canManage {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be owner or admin to close collection"})
		return
	}

	coll, err := h.db.CloseCollection(c.Request.Context(), collID)
	if err != nil {
		if err == sql.ErrNoRows || err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to close collection"})
		return
	}

	if coll.GroupID != groupID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "collection does not belong to group"})
		return
	}

	out := gin.H{"id": coll.ID, "group_id": coll.GroupID, "amount": coll.Amount, "status": coll.Status}
	if coll.Deadline.Valid {
		out["deadline"] = coll.Deadline.Time.UTC().Format(time.RFC3339)
	}
	if coll.CreatedAt.Valid {
		out["created_at"] = coll.CreatedAt.Time.UTC().Format(time.RFC3339)
	}

	c.JSON(http.StatusOK, out)
}

// UpdateCollection updates amount/deadline for a collection. Caller must be the owner or an admin.
func (h *CollectionsHandler) UpdateCollection(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	callerID, ok := userIDValue.(int64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	collIDStr := c.Param("collection_id")
	collID, err := strconv.ParseInt(collIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid collection id"})
		return
	}

	canManage, err := h.canManageGroup(c.Request.Context(), callerID, groupID)
	if err != nil {
		if err == sql.ErrNoRows || err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify group access"})
		return
	}
	if !canManage {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be owner or admin to update collection"})
		return
	}

	var req updateCollectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	t, err := time.Parse(time.RFC3339, req.Deadline)
	if err != nil {
		respondFieldValidationError(c, "deadline", "must be RFC3339 timestamp")
		return
	}

	coll, err := h.db.UpdateCollection(c.Request.Context(), db.UpdateCollectionParams{ID: collID, Amount: req.Amount, Deadline: pgtype.Timestamptz{Time: t, Valid: true}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update collection"})
		return
	}
	if coll.GroupID != groupID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "collection does not belong to group"})
		return
	}
	out := gin.H{"id": coll.ID, "group_id": coll.GroupID, "amount": coll.Amount, "status": coll.Status}
	if coll.Deadline.Valid {
		out["deadline"] = coll.Deadline.Time.UTC().Format(time.RFC3339)
	}
	if coll.CreatedAt.Valid {
		out["created_at"] = coll.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	c.JSON(http.StatusOK, out)
}

// DeleteCollection deletes a collection. Caller must be the owner or an admin.
func (h *CollectionsHandler) DeleteCollection(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	callerID, ok := userIDValue.(int64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	collIDStr := c.Param("collection_id")
	collID, err := strconv.ParseInt(collIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid collection id"})
		return
	}

	canManage, err := h.canManageGroup(c.Request.Context(), callerID, groupID)
	if err != nil {
		if err == sql.ErrNoRows || err == pgx.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify group access"})
		return
	}
	if !canManage {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be owner or admin to delete collection"})
		return
	}

	coll, err := h.db.DeleteCollection(c.Request.Context(), collID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete collection"})
		return
	}
	if coll.GroupID != groupID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "collection does not belong to group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": coll.ID})
}
