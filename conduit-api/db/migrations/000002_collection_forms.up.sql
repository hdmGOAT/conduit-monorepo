CREATE TYPE form_field_type AS ENUM ('text', 'textarea', 'number', 'date', 'select', 'checkbox', 'email', 'phone');

CREATE TABLE collection_forms (
    id BIGSERIAL PRIMARY KEY,
    collection_id BIGINT NOT NULL UNIQUE REFERENCES collections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE collection_form_fields (
    id BIGSERIAL PRIMARY KEY,
    form_id BIGINT NOT NULL REFERENCES collection_forms(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type form_field_type NOT NULL,
    placeholder TEXT,
    is_required BOOLEAN NOT NULL DEFAULT false,
    options JSONB,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (form_id, field_key),
    UNIQUE (form_id, sort_order)
);

CREATE TABLE collection_form_submissions (
    id BIGSERIAL PRIMARY KEY,
    form_id BIGINT NOT NULL REFERENCES collection_forms(id) ON DELETE CASCADE,
    collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (collection_id, user_id)
);

CREATE TABLE collection_form_answers (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES collection_form_submissions(id) ON DELETE CASCADE,
    field_id BIGINT NOT NULL REFERENCES collection_form_fields(id) ON DELETE CASCADE,
    value_text TEXT,
    value_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (submission_id, field_id)
);

CREATE INDEX idx_collection_forms_collection_id ON collection_forms(collection_id);
CREATE INDEX idx_collection_form_fields_form_id ON collection_form_fields(form_id);
CREATE INDEX idx_collection_form_submissions_form_id ON collection_form_submissions(form_id);
CREATE INDEX idx_collection_form_submissions_collection_id ON collection_form_submissions(collection_id);
CREATE INDEX idx_collection_form_submissions_user_id ON collection_form_submissions(user_id);
CREATE INDEX idx_collection_form_answers_submission_id ON collection_form_answers(submission_id);
