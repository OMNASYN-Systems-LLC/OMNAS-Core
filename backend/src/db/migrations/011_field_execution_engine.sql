ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS worker_user_id UUID REFERENCES worker_profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_category VARCHAR(120),
  ADD COLUMN IF NOT EXISTS work_completed TEXT,
  ADD COLUMN IF NOT EXISTS issues_blockers TEXT,
  ADD COLUMN IF NOT EXISTS weather TEXT,
  ADD COLUMN IF NOT EXISTS crew_size INTEGER CHECK (crew_size >= 0),
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS location JSONB,
  ADD COLUMN IF NOT EXISTS auto_summary TEXT,
  ADD COLUMN IF NOT EXISTS voice_transcript TEXT,
  ADD COLUMN IF NOT EXISTS detected_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS suggested_summary TEXT,
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_daily_logs_worker ON daily_logs(worker_user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_job ON daily_logs(job_id);
