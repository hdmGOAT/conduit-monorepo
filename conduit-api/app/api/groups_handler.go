package api

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"conduit-monorepo/conduit-api/app/api/middleware"
	"conduit-monorepo/conduit-api/internal/db"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type GroupsHandler struct {
	db db.Querier
}

func NewGroupsHandler(dbq db.Querier) *GroupsHandler {
	return &GroupsHandler{db: dbq}
}

type createGroupRequest struct {
	Name   string `json:"name" binding:"required"`
	IsOpen bool   `json:"is_open"`
}

func (h *GroupsHandler) CreateGroup(c *gin.Context) {
	var req createGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	userID, ok := userIDValue.(int64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	grp, err := h.db.CreateGroup(c.Request.Context(), db.CreateGroupParams{OwnerID: userID, Name: req.Name, IsOpen: req.IsOpen})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create group"})
		return
	}

	// add creator as admin membership
	_, err = h.db.AddMembership(c.Request.Context(), db.AddMembershipParams{Column1: userID, Column2: grp.ID, Column3: db.MembershipRoleAdmin})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add creator membership"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": grp.ID, "owner_id": grp.OwnerID, "name": grp.Name, "is_open": grp.IsOpen})
}

func (h *GroupsHandler) ListOwnedGroups(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	userID, ok := userIDValue.(int64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user context"})
		return
	}

	groups, err := h.db.ListGroupsByOwner(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list groups"})
		return
	}

	out := make([]gin.H, 0, len(groups))
	for _, g := range groups {
		out = append(out, gin.H{"id": g.ID, "owner_id": g.OwnerID, "name": g.Name})
	}

	c.JSON(http.StatusOK, out)
}

type addMembershipRequest struct {
	UserID int64  `json:"user_id" binding:"required"`
	Role   string `json:"role" binding:"required"`
}

func (h *GroupsHandler) AddMembership(c *gin.Context) {
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

	// check caller is admin
	memberships, err := h.db.ListGroupMemberships(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch memberships"})
		return
	}
	isAdmin := false
	for _, m := range memberships {
		if m.UserID == callerID && m.Role == db.MembershipRoleAdmin {
			isAdmin = true
			break
		}
	}
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be admin to add members"})
		return
	}

	var req addMembershipRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	var role db.MembershipRole
	switch req.Role {
	case string(db.MembershipRoleAdmin):
		role = db.MembershipRoleAdmin
	case string(db.MembershipRoleMember):
		role = db.MembershipRoleMember
	case string(db.MembershipRoleCollector):
		role = db.MembershipRoleCollector
	case string(db.MembershipRoleModerator):
		role = db.MembershipRoleModerator
	default:
		respondFieldValidationError(c, "role", "invalid role")
		return
	}

	m, err := h.db.AddMembership(c.Request.Context(), db.AddMembershipParams{Column1: req.UserID, Column2: groupID, Column3: role})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add membership"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user_id": m.UserID, "group_id": m.GroupID, "role": m.Role})
}

func (h *GroupsHandler) ListMemberships(c *gin.Context) {
	groupIDStr := c.Param("group_id")
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	memberships, err := h.db.ListGroupMemberships(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list memberships"})
		return
	}

	out := make([]gin.H, 0, len(memberships))
	for _, m := range memberships {
		out = append(out, gin.H{"user_id": m.UserID, "group_id": m.GroupID, "role": m.Role})
	}

	c.JSON(http.StatusOK, out)
}

type updateIsOpenRequest struct {
	IsOpen bool `json:"is_open" binding:"required"`
}

// ToggleIsOpen sets the group's open status. Only the group owner may change this.
func (h *GroupsHandler) ToggleIsOpen(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	userID, ok := userIDValue.(int64)
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

	grp, err := h.db.GetGroupByID(c.Request.Context(), groupID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch group"})
		return
	}
	if grp.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be owner to change open status"})
		return
	}

	var req updateIsOpenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	updated, err := h.db.UpdateGroupIsOpen(c.Request.Context(), db.UpdateGroupIsOpenParams{ID: groupID, IsOpen: req.IsOpen})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update group"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": updated.ID, "is_open": updated.IsOpen})
}

type updateGroupRequest struct {
	Name string `json:"name" binding:"required"`
}

// UpdateGroup updates the group's name. Only the group owner may update the group.
func (h *GroupsHandler) UpdateGroup(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	userID, ok := userIDValue.(int64)
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

	grp, err := h.db.GetGroupByID(c.Request.Context(), groupID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch group"})
		return
	}
	if grp.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be owner to update group"})
		return
	}

	var req updateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	updated, err := h.db.UpdateGroup(c.Request.Context(), db.UpdateGroupParams{ID: groupID, Name: req.Name})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update group"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": updated.ID, "name": updated.Name, "is_open": updated.IsOpen})
}

// DeleteGroup deletes a group and cascades deletions to related data. Only the owner may delete.
func (h *GroupsHandler) DeleteGroup(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	userID, ok := userIDValue.(int64)
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

	grp, err := h.db.GetGroupByID(c.Request.Context(), groupID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch group"})
		return
	}
	if grp.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be owner to delete group"})
		return
	}

	// Deleting the group will cascade to memberships, collections, join requests, etc.
	_, err = h.db.DeleteGroup(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete group"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"id": groupID, "deleted": true})
}

// RequestToJoin allows a user to join a group. If the group is open, the user is added immediately.
// Otherwise a join request is created with status 'pending'.
func (h *GroupsHandler) RequestToJoin(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	userID, ok := userIDValue.(int64)
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

	grp, err := h.db.GetGroupByID(c.Request.Context(), groupID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch group"})
		return
	}

	// check existing membership
	memberships, err := h.db.ListGroupMemberships(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch memberships"})
		return
	}
	for _, m := range memberships {
		if m.UserID == userID {
			c.JSON(http.StatusOK, gin.H{"message": "already a member", "role": m.Role})
			return
		}
	}

	// check for existing join request to make endpoint idempotent
	existingJRs, err := h.db.ListJoinRequestsByGroup(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check join requests"})
		return
	}
	for _, jr := range existingJRs {
		if jr.UserID == userID {
			c.JSON(http.StatusOK, gin.H{"user_id": jr.UserID, "group_id": jr.GroupID, "status": jr.Status, "message": "join request already exists"})
			return
		}
	}

	if grp.IsOpen {
		m, err := h.db.AddMembership(c.Request.Context(), db.AddMembershipParams{Column1: userID, Column2: groupID, Column3: db.MembershipRoleMember})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add membership"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user_id": m.UserID, "group_id": m.GroupID, "role": m.Role})
		return
	}

	// create join request
	jr, err := h.db.CreateJoinRequest(c.Request.Context(), db.CreateJoinRequestParams{Column1: userID, Column2: groupID, Column3: db.JoinRequestStatusPending})
	if err != nil {
		// handle potential race where another request was created concurrently
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create join request"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user_id": jr.UserID, "group_id": jr.GroupID, "status": jr.Status})
}

// ListJoinRequests returns pending/processed join requests for a group (admin-only).
func (h *GroupsHandler) ListJoinRequests(c *gin.Context) {
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

	memberships, err := h.db.ListGroupMemberships(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch memberships"})
		return
	}
	isAdmin := false
	for _, m := range memberships {
		if m.UserID == callerID && m.Role == db.MembershipRoleAdmin {
			isAdmin = true
			break
		}
	}
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be admin to view join requests"})
		return
	}

	jrs, err := h.db.ListJoinRequestsByGroup(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list join requests"})
		return
	}
	out := make([]gin.H, 0, len(jrs))
	for _, jr := range jrs {
		out = append(out, gin.H{"user_id": jr.UserID, "group_id": jr.GroupID, "status": jr.Status})
	}
	c.JSON(http.StatusOK, out)
}

type updateJoinRequestRequest struct {
	Status string `json:"status" binding:"required"`
	Role   string `json:"role"`
}

// HandleJoinRequest approves or denies a user's join request (admin-only).
func (h *GroupsHandler) HandleJoinRequest(c *gin.Context) {
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

	targetUserStr := c.Param("user_id")
	targetUserID, err := strconv.ParseInt(targetUserStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	memberships, err := h.db.ListGroupMemberships(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch memberships"})
		return
	}
	isAdmin := false
	for _, m := range memberships {
		if m.UserID == callerID && m.Role == db.MembershipRoleAdmin {
			isAdmin = true
			break
		}
	}
	if !isAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be admin to manage join requests"})
		return
	}

	var req updateJoinRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	var status db.JoinRequestStatus
	switch req.Status {
	case string(db.JoinRequestStatusApproved):
		status = db.JoinRequestStatusApproved
	case string(db.JoinRequestStatusDenied):
		status = db.JoinRequestStatusDenied
	default:
		respondFieldValidationError(c, "status", "invalid status")
		return
	}

	if status == db.JoinRequestStatusApproved {
		// determine role to grant
		role := db.MembershipRoleMember
		switch req.Role {
		case string(db.MembershipRoleAdmin):
			role = db.MembershipRoleAdmin
		case string(db.MembershipRoleCollector):
			role = db.MembershipRoleCollector
		case string(db.MembershipRoleModerator):
			role = db.MembershipRoleModerator
		case "", string(db.MembershipRoleMember):
			role = db.MembershipRoleMember
		default:
			respondFieldValidationError(c, "role", "invalid role")
			return
		}

		// create or update membership (idempotent). Only after membership succeeds do we mark the join request approved.
		m, err := h.db.AddMembership(c.Request.Context(), db.AddMembershipParams{Column1: targetUserID, Column2: groupID, Column3: role})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add membership"})
			return
		}

		_, err = h.db.UpdateJoinRequestStatus(c.Request.Context(), db.UpdateJoinRequestStatusParams{Column1: targetUserID, Column2: groupID, Column3: status})
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusNotFound, gin.H{"error": "join request not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update join request"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"user_id": m.UserID, "group_id": m.GroupID, "role": m.Role})
		return
	}

	jr, err := h.db.UpdateJoinRequestStatus(c.Request.Context(), db.UpdateJoinRequestStatusParams{Column1: targetUserID, Column2: groupID, Column3: status})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "join request not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update join request"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user_id": jr.UserID, "group_id": jr.GroupID, "status": jr.Status})
}

// LeaveGroup allows a member to remove themselves from a group.
func (h *GroupsHandler) LeaveGroup(c *gin.Context) {
	userIDValue, exists := c.Get(middleware.UserIDContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing user context"})
		return
	}
	userID, ok := userIDValue.(int64)
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

	// prevent group owner from leaving their own group
	grp, err := h.db.GetGroupByID(c.Request.Context(), groupID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch group"})
		return
	}
	if grp.OwnerID == userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "group owner cannot leave the group"})
		return
	}

	m, err := h.db.DeleteMembership(c.Request.Context(), db.DeleteMembershipParams{UserID: userID, GroupID: groupID})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "membership not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to leave group"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user_id": m.UserID, "group_id": m.GroupID, "role": m.Role})
}

// EjectMember allows admins and moderators to remove another user from the group.
func (h *GroupsHandler) EjectMember(c *gin.Context) {
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

	targetUserStr := c.Param("user_id")
	targetUserID, err := strconv.ParseInt(targetUserStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	grp, err := h.db.GetGroupByID(c.Request.Context(), groupID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch group"})
		return
	}
	if grp.OwnerID == targetUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot remove group owner"})
		return
	}

	memberships, err := h.db.ListGroupMemberships(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch memberships"})
		return
	}

	var callerRole db.MembershipRole
	var targetRole db.MembershipRole
	for _, m := range memberships {
		if m.UserID == callerID {
			callerRole = m.Role
		}
		if m.UserID == targetUserID {
			targetRole = m.Role
		}
	}

	// explicit membership existence check for caller
	if callerRole == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "caller is not a member of the group"})
		return
	}

	// only admins or moderators can manage members
	if callerRole != db.MembershipRoleAdmin && callerRole != db.MembershipRoleModerator {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be admin or moderator to remove members"})
		return
	}

	// explicit membership existence check for target after permission check
	if targetRole == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "target user is not a member of the group"})
		return
	}

	// moderators cannot remove admins
	if callerRole == db.MembershipRoleModerator && targetRole == db.MembershipRoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "moderators cannot remove admins"})
		return
	}

	m, err := h.db.DeleteMembership(c.Request.Context(), db.DeleteMembershipParams{UserID: targetUserID, GroupID: groupID})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "membership not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user_id": m.UserID, "group_id": m.GroupID, "role": m.Role})
}
