ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_status_check;
ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_status_check CHECK (status IN ('fetched', 'normalized', 'ready', 'imported'));

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS source_system VARCHAR(64),
  ADD COLUMN IF NOT EXISTS source_notice_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_org_source_notice_unique
  ON jobs(organization_id, source_notice_id)
  WHERE source_notice_id IS NOT NULL;
