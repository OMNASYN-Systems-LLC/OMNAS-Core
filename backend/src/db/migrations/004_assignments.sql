CREATE TABLE IF NOT EXISTS assignments (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_user_id UUID NOT NULL REFERENCES worker_profiles(user_id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES contractor_profiles(user_id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL CHECK (status IN ('offered', 'accepted', 'declined', 'active', 'completed', 'cancelled')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, worker_user_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_worker ON assignments(worker_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_job ON assignments(job_id);
