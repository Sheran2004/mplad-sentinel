CREATE TABLE IF NOT EXISTS mplad_case_reviews (
    work_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'reviewed', 'dismissed')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mplad_case_review_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    work_id TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL
        CHECK (new_status IN ('open', 'reviewed', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mplad_case_review_events_work_id_idx
    ON mplad_case_review_events (work_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mplad_case_reviews_status_idx
    ON mplad_case_reviews (status);