DROP INDEX IF EXISTS idx_collection_form_answers_submission_id;
DROP INDEX IF EXISTS idx_collection_form_submissions_user_id;
DROP INDEX IF EXISTS idx_collection_form_submissions_collection_id;
DROP INDEX IF EXISTS idx_collection_form_submissions_form_id;
DROP INDEX IF EXISTS idx_collection_form_fields_form_id;
DROP INDEX IF EXISTS idx_collection_forms_collection_id;

DROP TABLE IF EXISTS collection_form_answers;
DROP TABLE IF EXISTS collection_form_submissions;
DROP TABLE IF EXISTS collection_form_fields;
DROP TABLE IF EXISTS collection_forms;

DROP TYPE IF EXISTS form_field_type;
