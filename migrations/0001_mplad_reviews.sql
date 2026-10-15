CREATE TABLE IF NOT EXISTS mplad_case_reviews (
  work_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('open', 'reviewed', 'dismissed')),
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mplad_case_review_events (
  id BIGSERIAL PRIMARY KEY,
  work_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL CHECK (new_status IN ('open', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mplad_case_review_events_work_id_idx
  ON mplad_case_review_events (work_id, created_at DESC);
