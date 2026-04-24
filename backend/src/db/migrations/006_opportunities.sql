CREATE TABLE IF NOT EXISTS opportunities (
  id BIGSERIAL PRIMARY KEY,
  source_notice_id VARCHAR(128) NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  agency VARCHAR(255),
  naics_code VARCHAR(32),
  posted_date DATE,
  deadline TIMESTAMPTZ,
  raw_json JSONB NOT NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('fetched', 'normalized', 'ready')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_posted_date ON opportunities(posted_date);
