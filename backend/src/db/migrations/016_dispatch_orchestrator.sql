ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) NOT NULL DEFAULT 'standard';

ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_status_check;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_status_check CHECK (
    status IN ('offered', 'accepted', 'active', 'completed', 'declined', 'expired', 'ghosted', 'cancelled')
  );

ALTER TABLE assignments
  DROP CONSTRAINT IF EXISTS assignments_job_id_worker_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_live_offer_unique
  ON assignments(job_id, worker_user_id)
  WHERE status IN ('offered', 'accepted', 'active');

CREATE INDEX IF NOT EXISTS idx_assignments_offer_expiry ON assignments(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_assignments_retry_count ON assignments(job_id, retry_count);
