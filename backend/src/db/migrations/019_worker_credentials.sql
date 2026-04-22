-- Phase A: Worker credential tracking.
-- A credential is any expirable qualification: OSHA card, trade license, cert, etc.
-- Expiry is checked at check-in time (Phase B enforcement).

CREATE TABLE IF NOT EXISTS worker_credentials (
  id              BIGSERIAL PRIMARY KEY,
  worker_user_id  UUID         NOT NULL,
  credential_type VARCHAR(100) NOT NULL,  -- e.g. 'OSHA_30', 'EPA_608', 'CDL_A', 'electrician_license'
  credential_id   VARCHAR(255),           -- issuing body's license / cert number
  issued_at       DATE,
  expires_at      DATE,                   -- NULL = no expiry (lifetime credential)
  verified        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_credentials_worker ON worker_credentials(worker_user_id);
CREATE INDEX IF NOT EXISTS idx_worker_credentials_expiry
  ON worker_credentials(expires_at)
  WHERE expires_at IS NOT NULL;
