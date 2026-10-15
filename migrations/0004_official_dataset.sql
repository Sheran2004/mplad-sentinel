-- Real MPLADS dashboard data (completed works + allocations), normalized.
-- Loaded by `npm run db:seed` (deploy) or lazily on first request (local PGlite).

CREATE TABLE IF NOT EXISTS mplad_works (
  work_code       TEXT PRIMARY KEY,
  mp_ref          TEXT NOT NULL,
  fy              TEXT NOT NULL,
  work_type       TEXT NOT NULL,
  category        TEXT NOT NULL,
  state           TEXT NOT NULL,
  ida             TEXT NOT NULL,
  description     TEXT,
  mp_name         TEXT NOT NULL,
  mp_key          TEXT NOT NULL,
  chamber         TEXT NOT NULL CHECK (chamber IN ('LS', 'RS', 'unknown')),
  constituency    TEXT,
  has_image       BOOLEAN NOT NULL DEFAULT FALSE,
  completion_date DATE NOT NULL,
  amount          NUMERIC(16, 2),
  risk            INTEGER NOT NULL DEFAULT 0,
  severity        TEXT NOT NULL DEFAULT 'clear' CHECK (severity IN ('critical', 'high', 'watch', 'clear')),
  flag_count      INTEGER NOT NULL DEFAULT 0,
  flag_codes      TEXT NOT NULL DEFAULT '',
  search_text     TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS mplad_works_state_idx ON mplad_works (state);
CREATE INDEX IF NOT EXISTS mplad_works_type_idx ON mplad_works (work_type);
CREATE INDEX IF NOT EXISTS mplad_works_fy_idx ON mplad_works (fy);
CREATE INDEX IF NOT EXISTS mplad_works_mp_idx ON mplad_works (mp_key);
CREATE INDEX IF NOT EXISTS mplad_works_date_idx ON mplad_works (completion_date);
CREATE INDEX IF NOT EXISTS mplad_works_risk_idx ON mplad_works (risk DESC);
CREATE INDEX IF NOT EXISTS mplad_works_severity_idx ON mplad_works (severity);

CREATE TABLE IF NOT EXISTS mplad_flags (
  work_code   TEXT NOT NULL,
  code        TEXT NOT NULL,
  title       TEXT NOT NULL,
  explanation TEXT NOT NULL,
  points      INTEGER NOT NULL,
  evidence    JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (work_code, code)
);
CREATE INDEX IF NOT EXISTS mplad_flags_code_idx ON mplad_flags (code);

CREATE TABLE IF NOT EXISTS mplad_allocations (
  id           INTEGER PRIMARY KEY,
  chamber      TEXT NOT NULL CHECK (chamber IN ('LS', 'RS')),
  state        TEXT NOT NULL,
  mp_name      TEXT NOT NULL,
  mp_key       TEXT NOT NULL,
  constituency TEXT,
  member_type  TEXT,
  allocated    NUMERIC(16, 2)
);
CREATE INDEX IF NOT EXISTS mplad_allocations_mp_idx ON mplad_allocations (mp_key);

CREATE TABLE IF NOT EXISTS mplad_dataset_meta (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
