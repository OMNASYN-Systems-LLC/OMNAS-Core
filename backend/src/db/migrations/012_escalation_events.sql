CREATE TABLE IF NOT EXISTS escalation_events (
  id BIGSERIAL PRIMARY KEY,
  task_id VARCHAR(120) NOT NULL,
  zone VARCHAR(120) NOT NULL,
  reason TEXT NOT NULL,
  rule_triggered VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'AMBER',
  suggested_action TEXT,
  resolution_note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escalation_events_status_created_at ON escalation_events(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_events_task_id ON escalation_events(task_id);
