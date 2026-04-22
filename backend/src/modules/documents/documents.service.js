import eventBus from "../../infrastructure/events/eventBus.js";
import { assertRequiredFields } from "../../utils/validation.js";
import {
  insertDocument,
  findDocumentById,
  findDocumentsByJobId,
  insertDocumentVersion,
  getLatestVersionNumber,
  getVersionsByDocumentId,
  setDocumentCurrentVersion,
  updateDocumentStatus,
  insertDocumentLink,
  getLinksByDocumentId,
  insertDocumentReview,
  getReviewsByDocumentId,
} from "./documents.repository.js";

// ─── Events ──────────────────────────────────────────────────────────────────
// Defined locally; also registered in orchestrator/eventBus.js EVENTS map
// for future downstream handler wiring. No handlers are registered yet.

export const DOC_EVENTS = {
  UPLOADED:           "ON_DOC_UPLOADED",
  REVIEW_STARTED:     "ON_DOC_REVIEW_STARTED",
  APPROVED:           "ON_DOC_APPROVED",
  PARTIALLY_APPROVED: "ON_DOC_PARTIALLY_APPROVED",
  REJECTED:           "ON_DOC_REJECTED",
  SUPERSEDED:         "ON_DOC_SUPERSEDED",
};

// ─── Role guards ──────────────────────────────────────────────────────────────
// subcontractor, contractor, superintendent, gc, pm may upload and link
// contractor, superintendent, gc, pm may review
// all authenticated users may read (client/owner see only APPROVED)

const UPLOAD_ROLES  = new Set(["subcontractor", "contractor", "superintendent", "gc", "pm"]);
const REVIEW_ROLES  = new Set(["contractor", "superintendent", "gc", "pm"]);
const READONLY_ROLES = new Set(["client", "owner"]);

function assertCanUpload(auth) {
  if (!UPLOAD_ROLES.has(auth.role)) {
    const err = new Error("Insufficient permissions to upload documents");
    err.statusCode = 403;
    throw err;
  }
}

function assertCanReview(auth) {
  if (!REVIEW_ROLES.has(auth.role)) {
    const err = new Error("Insufficient permissions to review documents");
    err.statusCode = 403;
    throw err;
  }
}

const VALID_REVIEW_STATUSES = new Set(["UNDER_REVIEW", "APPROVED", "REJECTED", "PARTIALLY_APPROVED"]);

const REVIEW_EVENT_MAP = {
  UNDER_REVIEW:       DOC_EVENTS.REVIEW_STARTED,
  APPROVED:           DOC_EVENTS.APPROVED,
  REJECTED:           DOC_EVENTS.REJECTED,
  PARTIALLY_APPROVED: DOC_EVENTS.PARTIALLY_APPROVED,
};

// ─── Service functions ────────────────────────────────────────────────────────

export async function uploadDocument(payload, auth) {
  assertRequiredFields(payload, ["category", "title", "storageKey"]);
  assertCanUpload(auth);

  const jobId = payload.jobId ? Number(payload.jobId) : null;

  const doc = await insertDocument({
    jobId,
    category:  payload.category,
    title:     payload.title,
    createdBy: auth.userId,
  });

  const version = await insertDocumentVersion({
    documentId:    doc.id,
    versionNumber: 1,
    storageKey:    payload.storageKey,
    uploaderId:    auth.userId,
    hashSha256:    payload.hashSha256 ?? null,
  });

  const updated = await setDocumentCurrentVersion(doc.id, version.id, "UPLOADED");

  eventBus.emit(DOC_EVENTS.UPLOADED, {
    documentId: updated.id,
    jobId:      updated.job_id,
    category:   updated.category,
    uploadedBy: auth.userId,
  });

  return { document: updated, version };
}

export async function getDocument(id, auth) {
  const doc = await findDocumentById(id);
  if (!doc) {
    const err = new Error("Document not found");
    err.statusCode = 404;
    throw err;
  }

  // Read-only roles only see APPROVED documents unless they are the uploader
  if (READONLY_ROLES.has(auth.role) && doc.current_status !== "APPROVED" && doc.created_by !== auth.userId) {
    const err = new Error("Access restricted to approved documents");
    err.statusCode = 403;
    throw err;
  }

  const [versions, reviews, links] = await Promise.all([
    getVersionsByDocumentId(id),
    getReviewsByDocumentId(id),
    getLinksByDocumentId(id),
  ]);

  return { document: doc, versions, reviews, links };
}

export async function listProjectDocuments(jobId, auth) {
  const parsedJobId = jobId ? Number(jobId) : null;
  const docs = await findDocumentsByJobId(parsedJobId);

  if (READONLY_ROLES.has(auth.role)) {
    return docs.filter(d => d.current_status === "APPROVED");
  }

  return docs;
}

export async function addDocumentVersion(documentId, payload, auth) {
  assertRequiredFields(payload, ["storageKey"]);
  assertCanUpload(auth);

  const doc = await findDocumentById(documentId);
  if (!doc) {
    const err = new Error("Document not found");
    err.statusCode = 404;
    throw err;
  }

  const nextVersionNumber = (await getLatestVersionNumber(documentId)) + 1;

  const version = await insertDocumentVersion({
    documentId,
    versionNumber: nextVersionNumber,
    storageKey:    payload.storageKey,
    uploaderId:    auth.userId,
    hashSha256:    payload.hashSha256 ?? null,
  });

  // If the previous version was approved, emit superseded before resetting status
  if (doc.current_status === "APPROVED") {
    eventBus.emit(DOC_EVENTS.SUPERSEDED, {
      documentId,
      previousVersionId: doc.current_version_id,
      newVersionId:      version.id,
      jobId:             doc.job_id,
    });
  }

  // Point document to new version; status resets to UPLOADED (pending review)
  const updated = await setDocumentCurrentVersion(documentId, version.id, "UPLOADED");

  eventBus.emit(DOC_EVENTS.UPLOADED, {
    documentId,
    versionNumber: nextVersionNumber,
    uploadedBy:    auth.userId,
    jobId:         doc.job_id,
  });

  return { document: updated, version };
}

export async function linkDocumentToEntity(documentId, payload, auth) {
  assertRequiredFields(payload, ["entityType", "entityId"]);
  assertCanUpload(auth);

  const doc = await findDocumentById(documentId);
  if (!doc) {
    const err = new Error("Document not found");
    err.statusCode = 404;
    throw err;
  }

  const link = await insertDocumentLink({
    documentId,
    entityType: payload.entityType,
    entityId:   String(payload.entityId),
  });

  return link;
}

export async function reviewDocument(documentId, payload, auth) {
  assertRequiredFields(payload, ["status"]);
  assertCanReview(auth);

  if (!VALID_REVIEW_STATUSES.has(payload.status)) {
    const err = new Error(
      `Invalid review status. Allowed: ${[...VALID_REVIEW_STATUSES].join(", ")}`
    );
    err.statusCode = 400;
    throw err;
  }

  const doc = await findDocumentById(documentId);
  if (!doc) {
    const err = new Error("Document not found");
    err.statusCode = 404;
    throw err;
  }

  if (!doc.current_version_id) {
    const err = new Error("Document has no version to review");
    err.statusCode = 422;
    throw err;
  }

  const versionId = payload.versionId ?? doc.current_version_id;

  const review = await insertDocumentReview({
    documentId,
    versionId,
    reviewerId: auth.userId,
    status:     payload.status,
    comments:   payload.comments ?? null,
  });

  const updated = await updateDocumentStatus(documentId, payload.status);

  const event = REVIEW_EVENT_MAP[payload.status];
  if (event) {
    eventBus.emit(event, {
      documentId,
      versionId,
      reviewerId: auth.userId,
      status:     payload.status,
      jobId:      doc.job_id,
    });
  }

  return { document: updated, review };
}
