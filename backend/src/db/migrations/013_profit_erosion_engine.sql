CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS project_financial_profiles (
  project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id BIGINT UNIQUE NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contract_value NUMERIC(14,2) NOT NULL CHECK (contract_value >= 0),
  total_duration_days INTEGER NOT NULL CHECK (total_duration_days > 0),
  daily_burn_rate NUMERIC(14,2),
  labor_burden_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.25 CHECK (labor_burden_multiplier > 0),
  critical_path_weight NUMERIC(6,3) NOT NULL DEFAULT 1.0 CHECK (critical_path_weight > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profit_erosion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project_financial_profiles(project_id) ON DELETE CASCADE,
  category VARCHAR(24) NOT NULL CHECK (category IN ('TIME_LOSS', 'INEFFICIENCY', 'RISK')),
  driver_id VARCHAR(160) NOT NULL,
  daily_impact_usd NUMERIC(14,2) NOT NULL CHECK (daily_impact_usd >= 0),
  confidence_score NUMERIC(4,3) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_calculation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project_financial_profiles(project_id) ON DELETE CASCADE,
  run_type VARCHAR(32) NOT NULL DEFAULT 'daily',
  status VARCHAR(16) NOT NULL CHECK (status IN ('ok', 'warning', 'error')),
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profit_erosion_project_created ON profit_erosion_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_audit_project_created ON financial_calculation_audit_log(project_id, created_at DESC);
