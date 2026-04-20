CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  posted_by UUID NOT NULL REFERENCES contractor_profiles(user_id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  site_zip VARCHAR(20),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  pay_rate NUMERIC(10,2) NOT NULL CHECK (pay_rate >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paused', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS job_required_skills (
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  min_proficiency SMALLINT NOT NULL CHECK (min_proficiency BETWEEN 1 AND 5),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (job_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_posted_by ON jobs(posted_by);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
