CREATE TYPE membership_role AS ENUM ('admin', 'member', 'collector', 'moderator');
CREATE TYPE collection_status AS ENUM ('active', 'closed');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed');
CREATE TYPE payment_method AS ENUM ('stripe', 'cash');
CREATE TYPE cash_payment_status AS ENUM ('pending', 'confirmed');
CREATE TYPE outbox_status AS ENUM ('pending', 'processed');
CREATE TYPE form_field_type AS ENUM ('text', 'textarea', 'number', 'date', 'select', 'checkbox', 'email', 'phone');

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    pfp_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE groups (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE memberships (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role membership_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

CREATE TYPE join_request_status AS ENUM ('pending', 'approved', 'denied');

CREATE TABLE join_requests (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    status join_request_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, group_id)
);

CREATE TABLE collections (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    status collection_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    collection_id BIGINT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    method payment_method NOT NULL,
    stripe_payment_intent_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cash_payments (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
    status cash_payment_status NOT NULL DEFAULT 'pending',
    confirmed_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE TABLE outbox_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    aggregate_id BIGINT NOT NULL,
    payload JSONB NOT NULL,
    status outbox_status NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

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

CREATE TABLE refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_owner_id ON groups(owner_id);
CREATE INDEX idx_memberships_group_id ON memberships(group_id);
CREATE INDEX idx_collections_group_id ON collections(group_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_collection_id ON payments(collection_id);
CREATE INDEX idx_outbox_status_created_at ON outbox_events(status, created_at);
CREATE INDEX idx_collection_forms_collection_id ON collection_forms(collection_id);
CREATE INDEX idx_collection_form_fields_form_id ON collection_form_fields(form_id);
CREATE INDEX idx_collection_form_submissions_form_id ON collection_form_submissions(form_id);
CREATE INDEX idx_collection_form_submissions_collection_id ON collection_form_submissions(collection_id);
CREATE INDEX idx_collection_form_submissions_user_id ON collection_form_submissions(user_id);
CREATE INDEX idx_collection_form_answers_submission_id ON collection_form_answers(submission_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
