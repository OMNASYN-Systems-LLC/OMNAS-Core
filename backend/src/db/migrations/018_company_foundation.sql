-- Phase A: Minimum company infrastructure for governance enforcement.
-- contractor_companies is the org entity; worker_affiliations links workers to a company.
-- company_id FKs are added to jobs, assignments, and daily_logs as audit anchors.

CREATE TABLE IF NOT EXISTS contractor_companies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  license_number VARCHAR(100),
  owner_user_id  UUID NOT NULL,   -- the primary contractor user that owns this company
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_affiliations (
  id             BIGSERIAL PRIMARY KEY,
  worker_user_id UUID NOT NULL,
  company_id     UUID NOT NULL REFERENCES contractor_companies(id) ON DELETE CASCADE,
  role           VARCHAR(50)  NOT NULL DEFAULT 'member',   -- member | foreman | super
  status         VARCHAR(20)  NOT NULL DEFAULT 'active'    -- active | suspended | removed
                   CHECK (status IN ('active', 'suspended', 'removed')),
  joined_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (worker_user_id, company_id)
);

-- Which company posted / owns this job
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES contractor_companies(id);

-- Which company is performing the work on this assignment
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS performing_company_id UUID REFERENCES contractor_companies(id);

-- Audit trail: company the worker belonged to at log submission time
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES contractor_companies(id);

CREATE INDEX IF NOT EXISTS idx_worker_affiliations_worker  ON worker_affiliations(worker_user_id);
CREATE INDEX IF NOT EXISTS idx_worker_affiliations_company ON worker_affiliations(company_id);
CREATE INDEX IF NOT EXISTS idx_assignments_performing_co   ON assignments(performing_company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company               ON jobs(company_id);
