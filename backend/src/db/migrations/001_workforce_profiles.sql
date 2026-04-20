-- Workforce profile schema for OMNAS Assembler

CREATE TABLE IF NOT EXISTS worker_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  phone VARCHAR(30),
  home_zip VARCHAR(20),
  travel_radius_mi INTEGER CHECK (travel_radius_mi >= 0),
  trade_primary VARCHAR(100) NOT NULL,
  years_experience INTEGER CHECK (years_experience >= 0),
  rating_avg NUMERIC(3,2) DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contractor_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(160) NOT NULL,
  license_number VARCHAR(120) NOT NULL,
  bonding_limit NUMERIC(14,2) CHECK (bonding_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skills (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  label VARCHAR(120) NOT NULL,
  category VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_skills (
  worker_user_id UUID NOT NULL REFERENCES worker_profiles(user_id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency SMALLINT NOT NULL CHECK (proficiency BETWEEN 1 AND 5),
  years INTEGER NOT NULL CHECK (years >= 0),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (worker_user_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_worker_skills_worker ON worker_skills(worker_user_id);
