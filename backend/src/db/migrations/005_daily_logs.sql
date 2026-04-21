CREATE TABLE IF NOT EXISTS daily_logs (
  id BIGSERIAL PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  hours_worked NUMERIC(5,2) NOT NULL CHECK (hours_worked >= 0 AND hours_worked <= 24),
  work_summary TEXT NOT NULL,
  issues TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID NOT NULL REFERENCES worker_profiles(user_id) ON DELETE CASCADE,
  UNIQUE (assignment_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_assignment ON daily_logs(assignment_id);
