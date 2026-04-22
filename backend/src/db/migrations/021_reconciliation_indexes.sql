-- Reconciliation pass: additive fixes after Phase B compliance enforcement.
-- No structural renames. No data migrations. All changes are backward-safe.

-- 1. Composite index for the hot compliance check path.
--    getWorkerCompanyCompliance always filters on (worker_user_id, status = 'active').
--    The single-column idx_worker_affiliations_worker from migration 018 forces a
--    table scan on the status filter; this composite index eliminates that.
CREATE INDEX IF NOT EXISTS idx_worker_affiliations_worker_status
  ON worker_affiliations(worker_user_id, status);

-- 2. Index for triage COMPLIANCE_ALERTS query.
--    getNonActiveCompanies filters WHERE ccs.status IN ('PENDING', 'SUSPENDED').
CREATE INDEX IF NOT EXISTS idx_company_compliance_status
  ON company_compliance_states(status);

-- 3. updated_at column on worker_affiliations.
--    Status transitions (active → suspended → removed) had no change timestamp.
--    Added here so affiliation history is traceable without a full audit table.
ALTER TABLE worker_affiliations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Canonical schema note (no migration required):
--   daily_logs.company_id   — canonical column name (not employer_id).  Set by compliance module.
--   assignments.performing_company_id — nullable; populated at assignment acceptance (Phase C).
--   project_memberships     — intentionally deferred to Phase C; not yet in schema.
