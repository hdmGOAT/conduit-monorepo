-- name: CreateCollectionForm :one
INSERT INTO collection_forms (collection_id, title, description, is_required)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetCollectionFormByCollectionID :one
SELECT *
FROM collection_forms
WHERE collection_id = $1;

-- name: CreateCollectionFormField :one
INSERT INTO collection_form_fields (
    form_id,
    field_key,
    label,
    field_type,
    placeholder,
    is_required,
    options,
    sort_order
)
VALUES ($1, $2, $3, $4::form_field_type, $5, $6, $7, $8)
RETURNING *;

-- name: ListCollectionFormFields :many
SELECT *
FROM collection_form_fields
WHERE form_id = $1
ORDER BY sort_order;

-- name: UpdateCollectionFormField :one
UPDATE collection_form_fields
SET field_key = $2, label = $3, field_type = $4::form_field_type, placeholder = $5, is_required = $6, options = $7, sort_order = $8
WHERE id = $1
RETURNING *;

-- name: DeleteCollectionFormField :one
DELETE FROM collection_form_fields
WHERE id = $1
RETURNING *;

-- name: GetCollectionFormByID :one
SELECT *
FROM collection_forms
WHERE id = $1;

-- name: UpdateCollectionForm :one
UPDATE collection_forms
SET title = $2, description = $3, is_required = $4, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteCollectionForm :one
DELETE FROM collection_forms
WHERE id = $1
RETURNING *;

-- name: CreateFormSubmission :one
INSERT INTO collection_form_submissions (form_id, collection_id, user_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetFormSubmissionByID :one
SELECT *
FROM collection_form_submissions
WHERE id = $1;

-- name: ListFormSubmissionsByCollection :many
SELECT *
FROM collection_form_submissions
WHERE collection_id = $1
ORDER BY submitted_at DESC;

-- name: UpdateFormSubmission :one
UPDATE collection_form_submissions
SET form_id = $2, collection_id = $3
WHERE id = $1
RETURNING *;

-- name: DeleteFormSubmission :one
DELETE FROM collection_form_submissions
WHERE id = $1
RETURNING *;

-- name: AddFormAnswer :one
INSERT INTO collection_form_answers (submission_id, field_id, value_text, value_json)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetFormAnswerByID :one
SELECT *
FROM collection_form_answers
WHERE id = $1;

-- name: UpdateFormAnswer :one
UPDATE collection_form_answers
SET value_text = $2, value_json = $3
WHERE id = $1
RETURNING *;

-- name: DeleteFormAnswer :one
DELETE FROM collection_form_answers
WHERE id = $1
RETURNING *;

-- name: ListFormAnswersBySubmission :many
SELECT *
FROM collection_form_answers
WHERE submission_id = $1
ORDER BY id;
