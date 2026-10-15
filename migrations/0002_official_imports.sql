CREATE TABLE IF NOT EXISTS mplad_imported_works (
  work_id TEXT PRIMARY KEY,
  record JSONB NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  record_date DATE NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mplad_imported_works_record_date_idx
  ON mplad_imported_works (record_date DESC);

CREATE INDEX IF NOT EXISTS mplad_imported_works_source_name_idx
  ON mplad_imported_works (source_name);
