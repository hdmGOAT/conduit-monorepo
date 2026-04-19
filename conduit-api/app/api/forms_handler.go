package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"conduit-monorepo/conduit-api/app/api/middleware"
	"conduit-monorepo/conduit-api/internal/db"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
)

type FormsHandler struct {
	db db.Querier
}

func NewFormsHandler(dbq db.Querier) *FormsHandler {
	return &FormsHandler{db: dbq}
}

func textToInterface(t pgtype.Text) interface{} {
	if t.Valid {
		return t.String
	}
	return nil
}

func timeToInterface(t pgtype.Timestamptz) interface{} {
	if t.Valid {
		return t.Time.UTC().Format(time.RFC3339)
	}
	return nil
}

// CreateCollectionForm creates a form attached to a collection
func (h *FormsHandler) CreateCollectionForm(c *gin.Context) {
	collectionIDStr := c.Param("collection_id")
	collectionID, err := strconv.ParseInt(collectionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid collection id"})
		return
	}

	var req struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		IsRequired  bool   `json:"is_required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}

	desc := pgtype.Text{String: req.Description, Valid: req.Description != ""}
	form, err := h.db.CreateCollectionForm(c.Request.Context(), db.CreateCollectionFormParams{CollectionID: collectionID, Title: req.Title, Description: desc, IsRequired: req.IsRequired})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create form"})
		return
	}

	out := gin.H{"id": form.ID, "collection_id": form.CollectionID, "title": form.Title, "description": textToInterface(form.Description), "is_required": form.IsRequired}
	if form.CreatedAt.Valid {
		out["created_at"] = form.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	if form.UpdatedAt.Valid {
		out["updated_at"] = form.UpdatedAt.Time.UTC().Format(time.RFC3339)
	}
	c.JSON(http.StatusOK, out)
}

// GetCollectionForm returns a form and its fields by collection id
func (h *FormsHandler) GetCollectionForm(c *gin.Context) {
	collectionIDStr := c.Param("collection_id")
	collectionID, err := strconv.ParseInt(collectionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid collection id"})
		return
	}

	form, err := h.db.GetCollectionFormByCollectionID(c.Request.Context(), collectionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "form not found"})
		return
	}
	fields, _ := h.db.ListCollectionFormFields(c.Request.Context(), form.ID)

	fieldOut := make([]gin.H, 0, len(fields))
	for _, f := range fields {
		fieldOut = append(fieldOut, gin.H{"id": f.ID, "form_id": f.FormID, "field_key": f.FieldKey, "label": f.Label, "field_type": f.FieldType, "placeholder": textToInterface(f.Placeholder), "is_required": f.IsRequired, "options": f.Options, "sort_order": f.SortOrder})
	}

	out := gin.H{"id": form.ID, "collection_id": form.CollectionID, "title": form.Title, "description": textToInterface(form.Description), "is_required": form.IsRequired, "fields": fieldOut}
	if form.CreatedAt.Valid {
		out["created_at"] = form.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	if form.UpdatedAt.Valid {
		out["updated_at"] = form.UpdatedAt.Time.UTC().Format(time.RFC3339)
	}
	c.JSON(http.StatusOK, out)
}

// GetCollectionFormByID returns a form by id
func (h *FormsHandler) GetCollectionFormByID(c *gin.Context) {
	formIDStr := c.Param("form_id")
	formID, err := strconv.ParseInt(formIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}
	form, err := h.db.GetCollectionFormByID(c.Request.Context(), formID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "form not found"})
		return
	}
	fields, _ := h.db.ListCollectionFormFields(c.Request.Context(), form.ID)
	fieldOut := make([]gin.H, 0, len(fields))
	for _, f := range fields {
		fieldOut = append(fieldOut, gin.H{"id": f.ID, "form_id": f.FormID, "field_key": f.FieldKey, "label": f.Label, "field_type": f.FieldType, "placeholder": textToInterface(f.Placeholder), "is_required": f.IsRequired, "options": f.Options, "sort_order": f.SortOrder})
	}
	out := gin.H{"id": form.ID, "collection_id": form.CollectionID, "title": form.Title, "description": textToInterface(form.Description), "is_required": form.IsRequired, "fields": fieldOut}
	if form.CreatedAt.Valid {
		out["created_at"] = form.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	if form.UpdatedAt.Valid {
		out["updated_at"] = form.UpdatedAt.Time.UTC().Format(time.RFC3339)
	}
	c.JSON(http.StatusOK, out)
}

// UpdateCollectionForm updates a form
func (h *FormsHandler) UpdateCollectionForm(c *gin.Context) {
	formIDStr := c.Param("form_id")
	formID, err := strconv.ParseInt(formIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}
	var req struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		IsRequired  bool   `json:"is_required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}
	desc := pgtype.Text{String: req.Description, Valid: req.Description != ""}
	form, err := h.db.UpdateCollectionForm(c.Request.Context(), db.UpdateCollectionFormParams{ID: formID, Title: req.Title, Description: desc, IsRequired: req.IsRequired})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update form"})
		return
	}
	out := gin.H{"id": form.ID, "collection_id": form.CollectionID, "title": form.Title, "description": textToInterface(form.Description), "is_required": form.IsRequired}
	if form.UpdatedAt.Valid {
		out["updated_at"] = form.UpdatedAt.Time.UTC().Format(time.RFC3339)
	}
	c.JSON(http.StatusOK, out)
}

// DeleteCollectionForm deletes a form
func (h *FormsHandler) DeleteCollectionForm(c *gin.Context) {
	formIDStr := c.Param("form_id")
	formID, err := strconv.ParseInt(formIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}
	_, err = h.db.DeleteCollectionForm(c.Request.Context(), formID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete form"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": formID})
}

// CreateCollectionFormField creates a field for a form
func (h *FormsHandler) CreateCollectionFormField(c *gin.Context) {
	formIDStr := c.Param("form_id")
	formID, err := strconv.ParseInt(formIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}
	var req struct {
		FieldKey    string      `json:"field_key" binding:"required"`
		Label       string      `json:"label" binding:"required"`
		FieldType   string      `json:"field_type" binding:"required"`
		Placeholder string      `json:"placeholder"`
		IsRequired  bool        `json:"is_required"`
		Options     interface{} `json:"options"`
		SortOrder   int32       `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}
	var opts []byte
	if req.Options != nil {
		b, err := json.Marshal(req.Options)
		if err == nil {
			opts = b
		}
	}
	placeholder := pgtype.Text{String: req.Placeholder, Valid: req.Placeholder != ""}
	field, err := h.db.CreateCollectionFormField(c.Request.Context(), db.CreateCollectionFormFieldParams{FormID: formID, FieldKey: req.FieldKey, Label: req.Label, Column4: db.FormFieldType(req.FieldType), Placeholder: placeholder, IsRequired: req.IsRequired, Options: opts, SortOrder: req.SortOrder})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create field"})
		return
	}
	out := gin.H{"id": field.ID, "form_id": field.FormID, "field_key": field.FieldKey, "label": field.Label, "field_type": field.FieldType, "placeholder": textToInterface(field.Placeholder), "is_required": field.IsRequired, "options": field.Options, "sort_order": field.SortOrder}
	c.JSON(http.StatusOK, out)
}

// ListCollectionFormFields lists fields for a form
func (h *FormsHandler) ListCollectionFormFields(c *gin.Context) {
	formIDStr := c.Param("form_id")
	formID, err := strconv.ParseInt(formIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}
	fields, err := h.db.ListCollectionFormFields(c.Request.Context(), formID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list fields"})
		return
	}
	out := make([]gin.H, 0, len(fields))
	for _, f := range fields {
		out = append(out, gin.H{"id": f.ID, "form_id": f.FormID, "field_key": f.FieldKey, "label": f.Label, "field_type": f.FieldType, "placeholder": textToInterface(f.Placeholder), "is_required": f.IsRequired, "options": f.Options, "sort_order": f.SortOrder})
	}
	c.JSON(http.StatusOK, out)
}

// CreateFormSubmission creates a submission and optional answers
func (h *FormsHandler) CreateFormSubmission(c *gin.Context) {
	formIDStr := c.Param("form_id")
	formID, err := strconv.ParseInt(formIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid form id"})
		return
	}
	var req struct {
		CollectionID int64 `json:"collection_id" binding:"required"`
		Answers      []struct {
			FieldID   int64       `json:"field_id"`
			ValueText string      `json:"value_text"`
			ValueJSON interface{} `json:"value_json"`
		} `json:"answers"`
	}
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
	sub, err := h.db.CreateFormSubmission(c.Request.Context(), db.CreateFormSubmissionParams{FormID: formID, CollectionID: req.CollectionID, UserID: userID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create submission"})
		return
	}
	// add answers
	for _, a := range req.Answers {
		var valJson []byte
		if a.ValueJSON != nil {
			if b, err := json.Marshal(a.ValueJSON); err == nil {
				valJson = b
			}
		}
		vt := pgtype.Text{String: a.ValueText, Valid: a.ValueText != ""}
		_, _ = h.db.AddFormAnswer(c.Request.Context(), db.AddFormAnswerParams{SubmissionID: sub.ID, FieldID: a.FieldID, ValueText: vt, ValueJson: valJson})
	}
	c.JSON(http.StatusOK, gin.H{"id": sub.ID, "form_id": sub.FormID, "collection_id": sub.CollectionID, "user_id": sub.UserID})
}

// ListFormSubmissionsByCollection lists submissions for a collection
func (h *FormsHandler) ListFormSubmissionsByCollection(c *gin.Context) {
	collectionIDStr := c.Param("collection_id")
	collectionID, err := strconv.ParseInt(collectionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid collection id"})
		return
	}
	subs, err := h.db.ListFormSubmissionsByCollection(c.Request.Context(), collectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list submissions"})
		return
	}
	out := make([]gin.H, 0, len(subs))
	for _, s := range subs {
		out = append(out, gin.H{"id": s.ID, "form_id": s.FormID, "collection_id": s.CollectionID, "user_id": s.UserID, "submitted_at": timeToInterface(s.SubmittedAt)})
	}
	c.JSON(http.StatusOK, out)
}

// GetFormSubmissionByID returns a submission by id
func (h *FormsHandler) GetFormSubmissionByID(c *gin.Context) {
	submissionIDStr := c.Param("submission_id")
	submissionID, err := strconv.ParseInt(submissionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}
	sub, err := h.db.GetFormSubmissionByID(c.Request.Context(), submissionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "submission not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": sub.ID, "form_id": sub.FormID, "collection_id": sub.CollectionID, "user_id": sub.UserID, "submitted_at": timeToInterface(sub.SubmittedAt)})
}

// UpdateFormSubmission updates a submission
func (h *FormsHandler) UpdateFormSubmission(c *gin.Context) {
	submissionIDStr := c.Param("submission_id")
	submissionID, err := strconv.ParseInt(submissionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}
	var req struct {
		FormID       int64 `json:"form_id" binding:"required"`
		CollectionID int64 `json:"collection_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}
	sub, err := h.db.UpdateFormSubmission(c.Request.Context(), db.UpdateFormSubmissionParams{ID: submissionID, FormID: req.FormID, CollectionID: req.CollectionID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update submission"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": sub.ID, "form_id": sub.FormID, "collection_id": sub.CollectionID, "user_id": sub.UserID})
}

// DeleteFormSubmission deletes a submission
func (h *FormsHandler) DeleteFormSubmission(c *gin.Context) {
	submissionIDStr := c.Param("submission_id")
	submissionID, err := strconv.ParseInt(submissionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}
	_, err = h.db.DeleteFormSubmission(c.Request.Context(), submissionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete submission"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": submissionID})
}

// AddFormAnswer adds an answer to a submission
func (h *FormsHandler) AddFormAnswer(c *gin.Context) {
	submissionIDStr := c.Param("submission_id")
	submissionID, err := strconv.ParseInt(submissionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}
	var req struct {
		FieldID   int64       `json:"field_id" binding:"required"`
		ValueText string      `json:"value_text"`
		ValueJSON interface{} `json:"value_json"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}
	var valJson []byte
	if req.ValueJSON != nil {
		if b, err := json.Marshal(req.ValueJSON); err == nil {
			valJson = b
		}
	}
	vt := pgtype.Text{String: req.ValueText, Valid: req.ValueText != ""}
	ans, err := h.db.AddFormAnswer(c.Request.Context(), db.AddFormAnswerParams{SubmissionID: submissionID, FieldID: req.FieldID, ValueText: vt, ValueJson: valJson})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add answer"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": ans.ID, "submission_id": ans.SubmissionID, "field_id": ans.FieldID, "value_text": textToInterface(ans.ValueText), "value_json": ans.ValueJson})
}

// ListFormAnswersBySubmission lists answers
func (h *FormsHandler) ListFormAnswersBySubmission(c *gin.Context) {
	submissionIDStr := c.Param("submission_id")
	submissionID, err := strconv.ParseInt(submissionIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid submission id"})
		return
	}
	answers, err := h.db.ListFormAnswersBySubmission(c.Request.Context(), submissionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list answers"})
		return
	}
	out := make([]gin.H, 0, len(answers))
	for _, a := range answers {
		out = append(out, gin.H{"id": a.ID, "submission_id": a.SubmissionID, "field_id": a.FieldID, "value_text": textToInterface(a.ValueText), "value_json": a.ValueJson, "created_at": timeToInterface(a.CreatedAt)})
	}
	c.JSON(http.StatusOK, out)
}

// GetFormAnswerByID returns an answer
func (h *FormsHandler) GetFormAnswerByID(c *gin.Context) {
	answerIDStr := c.Param("answer_id")
	answerID, err := strconv.ParseInt(answerIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid answer id"})
		return
	}
	a, err := h.db.GetFormAnswerByID(c.Request.Context(), answerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "answer not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": a.ID, "submission_id": a.SubmissionID, "field_id": a.FieldID, "value_text": textToInterface(a.ValueText), "value_json": a.ValueJson, "created_at": timeToInterface(a.CreatedAt)})
}

// UpdateFormAnswer updates an answer
func (h *FormsHandler) UpdateFormAnswer(c *gin.Context) {
	answerIDStr := c.Param("answer_id")
	answerID, err := strconv.ParseInt(answerIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid answer id"})
		return
	}
	var req struct {
		ValueText string      `json:"value_text"`
		ValueJSON interface{} `json:"value_json"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondValidationError(c, err)
		return
	}
	var valJson []byte
	if req.ValueJSON != nil {
		if b, err := json.Marshal(req.ValueJSON); err == nil {
			valJson = b
		}
	}
	vt := pgtype.Text{String: req.ValueText, Valid: req.ValueText != ""}
	ans, err := h.db.UpdateFormAnswer(c.Request.Context(), db.UpdateFormAnswerParams{ID: answerID, ValueText: vt, ValueJson: valJson})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update answer"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": ans.ID, "submission_id": ans.SubmissionID, "field_id": ans.FieldID, "value_text": textToInterface(ans.ValueText), "value_json": ans.ValueJson})
}

// DeleteFormAnswer deletes an answer
func (h *FormsHandler) DeleteFormAnswer(c *gin.Context) {
	answerIDStr := c.Param("answer_id")
	answerID, err := strconv.ParseInt(answerIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid answer id"})
		return
	}
	_, err = h.db.DeleteFormAnswer(c.Request.Context(), answerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete answer"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": answerID})
}
