-- Migration 022: compliance_overrides
-- Minimum viable waiver table for the pilot override flow.
-- An active override causes checkAcceptanceEligibility / checkCheckinEligibility
-- to pass-through instead of blocking, providing a manual escape hatch for GC/Prime.

CREATE TABLE IF NOT EXISTS compliance_overrides (
  id              BIGSERIAL      PRIMARY KEY,
  override_type   VARCHAR(50)    NOT NULL CHECK (override_type IN ('ASSIGNMENT_ACCEPT', 'CHECKIN')),
  reason_code     VARCHAR(100)   NOT NULL,
  reason_text     TEXT,
  worker_user_id  UUID           REFERENCES worker_profiles(user_id) ON DELETE CASCADE,
  company_id      UUID           REFERENCES contractor_companies(id)  ON DELETE CASCADE,
  entity_type     VARCHAR(50),
  entity_id       BIGINT,
  authorized_by   UUID           NOT NULL REFERENCES worker_profiles(user_id),
  authorized_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ    NOT NULL,
  status          VARCHAR(20)    NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'expired', 'revoked')),
  CONSTRAINT co_target_required CHECK (worker_user_id IS NOT NULL OR company_id IS NOT NULL)
);

-- Fast lookup for the enforcement hot-path: is there an active override for this worker?
CREATE INDEX IF NOT EXISTS idx_overrides_worker_type_status
  ON compliance_overrides (worker_user_id, override_type, status)
  WHERE status = 'active';

-- Fast lookup by company for GC dashboard / list view.
CREATE INDEX IF NOT EXISTS idx_overrides_company_status
  ON compliance_overrides (company_id, status)
  WHERE status = 'active';

-- TTL sweep: find overrides that have passed their expiry timestamp.
CREATE INDEX IF NOT EXISTS idx_overrides_expires_active
  ON compliance_overrides (expires_at)
  WHERE status = 'active';
