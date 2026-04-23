-- Foundation migration: users table.
-- Must run before 001_workforce_profiles.sql, which creates worker_profiles and
-- contractor_profiles with FK references to users(id).
--
-- The backend auth service is a pilot stub that does not write to this table.
-- The table exists solely to satisfy the FK constraints declared in migration 001.
-- Pilot users are inserted via seed scripts; production will replace this with
-- a real identity provider integration.

CREATE TABLE IF NOT EXISTS users (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(160) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
