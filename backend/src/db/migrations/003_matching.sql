CREATE TABLE IF NOT EXISTS worker_availability (
  id BIGSERIAL PRIMARY KEY,
  worker_user_id UUID NOT NULL REFERENCES worker_profiles(user_id) ON DELETE CASCADE,
  available_start TIMESTAMPTZ NOT NULL,
  available_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (available_end >= available_start)
);

CREATE TABLE IF NOT EXISTS match_scores (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_user_id UUID NOT NULL REFERENCES worker_profiles(user_id) ON DELETE CASCADE,
  score NUMERIC(6,2) NOT NULL,
  score_breakdown JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, worker_user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_scores_job ON match_scores(job_id);
CREATE INDEX IF NOT EXISTS idx_worker_availability_worker ON worker_availability(worker_user_id);
