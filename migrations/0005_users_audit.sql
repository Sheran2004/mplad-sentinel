-- Accounts, roles and an audit trail for review actions.

CREATE TABLE IF NOT EXISTS mplad_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'reviewer', 'viewer')),
  password_hash TEXT NOT NULL,
  disabled      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mplad_audit_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    TEXT,
  user_email TEXT,
  action     TEXT NOT NULL,
  work_code  TEXT,
  detail     JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS mplad_audit_log_at_idx ON mplad_audit_log (at DESC);
CREATE INDEX IF NOT EXISTS mplad_audit_log_work_idx ON mplad_audit_log (work_code);

ALTER TABLE mplad_case_reviews ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';
ALTER TABLE mplad_case_reviews ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE mplad_case_review_events ADD COLUMN IF NOT EXISTS user_email TEXT;
