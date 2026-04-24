CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS contractor_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name VARCHAR(200),
  dba_name VARCHAR(200),
  tax_id VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED')),
  invite_token VARCHAR(128) UNIQUE,
  claimed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_affiliations (
  id BIGSERIAL PRIMARY KEY,
  worker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES contractor_companies(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL DEFAULT 'WORKER' CHECK (role IN ('OWNER', 'ADMIN', 'WORKER')),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_user_id, company_id)
);

CREATE TABLE IF NOT EXISTS project_memberships (
  id BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES contractor_companies(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL DEFAULT 'SUB' CHECK (role IN ('GC', 'SUB', 'STAFFING')),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, company_id)
);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES contractor_companies(id) ON DELETE SET NULL;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS performing_company_id UUID REFERENCES contractor_companies(id) ON DELETE SET NULL;

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS employer_id UUID REFERENCES contractor_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_worker_affiliations_worker ON worker_affiliations(worker_user_id);
CREATE INDEX IF NOT EXISTS idx_worker_affiliations_company ON worker_affiliations(company_id);
CREATE INDEX IF NOT EXISTS idx_project_memberships_project ON project_memberships(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_assignments_performing_company_id ON assignments(performing_company_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_employer_id ON daily_logs(employer_id);
