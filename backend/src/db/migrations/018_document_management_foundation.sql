-- Document Management Foundation (Pack 01)
-- Job-oriented linkage: documents belong to jobs (no project abstraction exists yet).
-- Superseded documents are tracked via event; old versions are preserved in document_versions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── documents ───────────────────────────────────────────────────────────────
-- One document record per logical artifact (contract, RFI, QC report, etc.).
-- current_version_id points to the active version; set after first upload.

CREATE TABLE IF NOT EXISTS documents (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             BIGINT       REFERENCES jobs(id) ON DELETE CASCADE,
  category           VARCHAR(64)  NOT NULL,
  title              VARCHAR(255) NOT NULL,
  current_status     VARCHAR(32)  NOT NULL DEFAULT 'UPLOADED',
  current_version_id UUID         NULL,
  created_by         UUID         NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT documents_status_check CHECK (
    current_status IN (
      'UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
      'PARTIALLY_APPROVED', 'SUPERSEDED', 'ARCHIVED'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_documents_job_id     ON documents(job_id);
CREATE INDEX IF NOT EXISTS idx_documents_status     ON documents(current_status);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);

-- ─── document_versions ───────────────────────────────────────────────────────
-- Immutable version history. storage_key is the opaque URI/path returned by
-- the caller's storage layer (S3 key, local path, etc.). Never deleted.

CREATE TABLE IF NOT EXISTS document_versions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER      NOT NULL,
  storage_key    VARCHAR(512) NOT NULL,
  uploader_id    UUID         NOT NULL,
  hash_sha256    VARCHAR(64),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT document_versions_unique UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_document_id ON document_versions(document_id);

-- ─── document_links ──────────────────────────────────────────────────────────
-- Flexible cross-references: a document can be linked to any entity
-- (assignment, escalation event, RFI, schedule phase, etc.) by entity_type + entity_id.

CREATE TABLE IF NOT EXISTS document_links (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  entity_type VARCHAR(64)  NOT NULL,
  entity_id   VARCHAR(128) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_links_document_id ON document_links(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_links_entity      ON document_links(entity_type, entity_id);

-- ─── document_reviews ────────────────────────────────────────────────────────
-- One review record per review action. Multiple reviews are possible per version
-- (e.g., partial approval followed by full approval).

CREATE TABLE IF NOT EXISTS document_reviews (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_id  UUID         NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  reviewer_id UUID         NOT NULL,
  status      VARCHAR(32)  NOT NULL,
  comments    TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT document_reviews_status_check CHECK (
    status IN ('UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PARTIALLY_APPROVED')
  )
);

CREATE INDEX IF NOT EXISTS idx_doc_reviews_document_id ON document_reviews(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_reviews_version_id  ON document_reviews(version_id);
