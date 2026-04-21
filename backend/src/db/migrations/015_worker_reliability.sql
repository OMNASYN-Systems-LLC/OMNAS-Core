ALTER TABLE worker_profiles
  ADD COLUMN IF NOT EXISTS reliability_score NUMERIC(5,3)
    CHECK (reliability_score >= 0 AND reliability_score <= 1);

CREATE INDEX IF NOT EXISTS idx_worker_profiles_reliability
  ON worker_profiles(reliability_score DESC NULLS LAST);
