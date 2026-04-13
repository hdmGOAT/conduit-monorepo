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

-- name: CreateFormSubmission :one
INSERT INTO collection_form_submissions (form_id, collection_id, user_id)
VALUES ($1, $2, $3)
RETURNING *;

-- name: AddFormAnswer :one
INSERT INTO collection_form_answers (submission_id, field_id, value_text, value_json)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListFormAnswersBySubmission :many
SELECT *
FROM collection_form_answers
WHERE submission_id = $1
ORDER BY id;
