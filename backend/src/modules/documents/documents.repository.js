import { db } from "../../config/db.js";

const DOC_COLS = `
  id, job_id, category, title, current_status, current_version_id,
  created_by, created_at, updated_at
`;

// ─── documents ───────────────────────────────────────────────────────────────

export async function insertDocument({ jobId, category, title, createdBy }) {
  const { rows } = await db.query(
    `INSERT INTO documents (job_id, category, title, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING ${DOC_COLS}`,
    [jobId ?? null, category, title, createdBy]
  );
  return rows[0];
}

export async function findDocumentById(id) {
  const { rows } = await db.query(
    `SELECT ${DOC_COLS} FROM documents WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findDocumentsByJobId(jobId) {
  const { rows } = await db.query(
    `SELECT ${DOC_COLS}
     FROM documents
     WHERE ($1::BIGINT IS NULL OR job_id = $1)
     ORDER BY created_at DESC`,
    [jobId ?? null]
  );
  return rows;
}

export async function setDocumentCurrentVersion(documentId, versionId, status) {
  const { rows } = await db.query(
    `UPDATE documents
     SET current_version_id = $2,
         current_status     = $3,
         updated_at         = NOW()
     WHERE id = $1
     RETURNING ${DOC_COLS}`,
    [documentId, versionId, status]
  );
  return rows[0] ?? null;
}

export async function updateDocumentStatus(documentId, status) {
  const { rows } = await db.query(
    `UPDATE documents
     SET current_status = $2,
         updated_at     = NOW()
     WHERE id = $1
     RETURNING ${DOC_COLS}`,
    [documentId, status]
  );
  return rows[0] ?? null;
}

// ─── document_versions ───────────────────────────────────────────────────────

export async function insertDocumentVersion({ documentId, versionNumber, storageKey, uploaderId, hashSha256 }) {
  const { rows } = await db.query(
    `INSERT INTO document_versions
       (document_id, version_number, storage_key, uploader_id, hash_sha256)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [documentId, versionNumber, storageKey, uploaderId, hashSha256 ?? null]
  );
  return rows[0];
}

export async function getLatestVersionNumber(documentId) {
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(version_number), 0) AS max_version
     FROM document_versions
     WHERE document_id = $1`,
    [documentId]
  );
  return Number(rows[0]?.max_version ?? 0);
}

export async function getVersionsByDocumentId(documentId) {
  const { rows } = await db.query(
    `SELECT * FROM document_versions
     WHERE document_id = $1
     ORDER BY version_number ASC`,
    [documentId]
  );
  return rows;
}

// ─── document_links ──────────────────────────────────────────────────────────

export async function insertDocumentLink({ documentId, entityType, entityId }) {
  const { rows } = await db.query(
    `INSERT INTO document_links (document_id, entity_type, entity_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [documentId, entityType, entityId]
  );
  return rows[0];
}

export async function getLinksByDocumentId(documentId) {
  const { rows } = await db.query(
    `SELECT * FROM document_links
     WHERE document_id = $1
     ORDER BY created_at ASC`,
    [documentId]
  );
  return rows;
}

// ─── document_reviews ────────────────────────────────────────────────────────

export async function insertDocumentReview({ documentId, versionId, reviewerId, status, comments }) {
  const { rows } = await db.query(
    `INSERT INTO document_reviews
       (document_id, version_id, reviewer_id, status, comments, reviewed_at)
     VALUES ($1, $2, $3, $4, $5,
       CASE WHEN $4 IN ('APPROVED','REJECTED','PARTIALLY_APPROVED') THEN NOW() ELSE NULL END
     )
     RETURNING *`,
    [documentId, versionId, reviewerId, status, comments ?? null]
  );
  return rows[0];
}

export async function getReviewsByDocumentId(documentId) {
  const { rows } = await db.query(
    `SELECT * FROM document_reviews
     WHERE document_id = $1
     ORDER BY created_at DESC`,
    [documentId]
  );
  return rows;
}
