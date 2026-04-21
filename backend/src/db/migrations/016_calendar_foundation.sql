-- Calendar Foundation (Pack A)
-- Renamed from PR #5's 015_calendar_foundation.sql to avoid conflict with
-- 015_worker_reliability.sql which was merged on the main dev branch first.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS calendar_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         BIGINT      REFERENCES jobs(id) ON DELETE CASCADE,
  assignment_id  BIGINT      REFERENCES assignments(id) ON DELETE SET NULL,
  worker_user_id UUID        REFERENCES worker_profiles(user_id) ON DELETE SET NULL,
  type           VARCHAR(32)  NOT NULL,
  title          VARCHAR(255) NOT NULL,
  start_time     TIMESTAMPTZ  NOT NULL,
  end_time       TIMESTAMPTZ  NOT NULL,
  status         VARCHAR(32)  NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_job_id
  ON calendar_events(job_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_worker_id
  ON calendar_events(worker_user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time
  ON calendar_events(start_time);
