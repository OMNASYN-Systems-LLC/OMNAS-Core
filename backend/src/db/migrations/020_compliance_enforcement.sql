-- Phase B: Company compliance state machine + hard-block audit log.
-- company_compliance_states holds the live status (PENDING | ACTIVE | SUSPENDED).
-- company_compliance_history is an append-only audit trail of every status change.
-- audit_block_log records every hard block event with a machine-readable reason code
-- so the system can always explain why an action was denied.

CREATE TABLE IF NOT EXISTS company_compliance_states (
  id           BIGSERIAL    PRIMARY KEY,
  company_id   UUID         NOT NULL UNIQUE REFERENCES contractor_companies(id) ON DELETE CASCADE,
  status       VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),
  reason       TEXT,            -- human-readable explanation of current state
  reason_code  VARCHAR(50),     -- machine-readable code matching BLOCK_REASON constants
  changed_by   UUID,            -- user_id who last changed state; NULL = system action
  effective_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Immutable append-only log of every compliance status transition
CREATE TABLE IF NOT EXISTS company_compliance_history (
  id          BIGSERIAL    PRIMARY KEY,
  company_id  UUID         NOT NULL REFERENCES contractor_companies(id) ON DELETE CASCADE,
  from_status VARCHAR(20),
  to_status   VARCHAR(20)  NOT NULL,
  reason      TEXT,
  reason_code VARCHAR(50),
  changed_by  UUID,
  changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Hard-block audit log: every denied action is recorded here with a reason code.
-- block_type:  ASSIGNMENT_ACCEPT | CHECKIN | OFFER_LOCK
-- reason_code: COMPANY_SUSPENDED | COMPANY_NOT_ACTIVE | CREDENTIAL_EXPIRED | CREDENTIAL_MISSING
CREATE TABLE IF NOT EXISTS audit_block_log (
  id             BIGSERIAL    PRIMARY KEY,
  block_type     VARCHAR(50)  NOT NULL,
  reason_code    VARCHAR(100) NOT NULL,
  reason_detail  TEXT         NOT NULL,
  entity_type    VARCHAR(50)  NOT NULL,   -- 'assignment' | 'daily_log'
  entity_id      BIGINT,                  -- id of the blocked entity (NULL for pre-creation blocks)
  worker_user_id UUID,
  company_id     UUID,
  context        JSONB        NOT NULL DEFAULT '{}',
  blocked_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_compliance_company
  ON company_compliance_states(company_id);

CREATE INDEX IF NOT EXISTS idx_company_compliance_history_co
  ON company_compliance_history(company_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_block_log_worker
  ON audit_block_log(worker_user_id, blocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_block_log_company
  ON audit_block_log(company_id, blocked_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_block_log_entity
  ON audit_block_log(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_block_log_type_time
  ON audit_block_log(block_type, blocked_at DESC);
