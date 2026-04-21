CREATE TABLE IF NOT EXISTS directives (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  action_id VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  target_role VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'responded', 'ignored')),
  created_by UUID NOT NULL,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_directives_job_id ON directives(job_id);
CREATE INDEX IF NOT EXISTS idx_directives_status ON directives(status, created_at DESC);
