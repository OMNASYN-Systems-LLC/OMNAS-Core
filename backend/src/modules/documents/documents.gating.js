import { db } from "../../config/db.js";
import { patchJobDocGating } from "../jobs/repository.js";

// ─── Gating states ────────────────────────────────────────────────────────────
// READY          — no blocking docs; autofill and scheduling proceed normally
// LOCKED         — one or more docs are UPLOADED or UNDER_REVIEW (unresolved)
// LOCKED_PARTIAL — all linked docs resolved but ≥1 is PARTIALLY_APPROVED;
//                  prep/mobilization work may proceed, install dispatch blocked
// AT_RISK        — one or more linked docs are REJECTED

export const GATING_STATES = {
  READY:          "READY",
  LOCKED:         "LOCKED",
  LOCKED_PARTIAL: "LOCKED_PARTIAL",
  AT_RISK:        "AT_RISK",
};

// Docs in SUPERSEDED or ARCHIVED are historical/terminal and excluded from
// active gating consideration. Only current, unresolved states gate the job.
const PENDING_STATUSES = new Set(["UPLOADED", "UNDER_REVIEW"]);

async function fetchActiveLinkedDocStatuses(jobId) {
  const { rows } = await db.query(
    `SELECT d.id, d.title, d.category, d.current_status
     FROM document_links dl
     JOIN documents d ON d.id = dl.document_id
     WHERE dl.entity_type = 'job'
       AND dl.entity_id   = $1::TEXT
       AND d.current_status NOT IN ('SUPERSEDED', 'ARCHIVED')`,
    [String(jobId)]
  );
  return rows;
}

function deriveGatingState(docs) {
  if (docs.length === 0) {
    return { state: GATING_STATES.READY, reason: "no_docs_linked" };
  }

  const statuses = docs.map((d) => d.current_status);

  // AT_RISK overrides everything — any rejected doc blocks the job
  if (statuses.includes("REJECTED")) {
    return {
      state: GATING_STATES.AT_RISK,
      reason: "doc_rejected",
      blockedDocIds: docs
        .filter((d) => d.current_status === "REJECTED")
        .map((d) => d.id),
    };
  }

  const allApproved = statuses.every((s) => s === "APPROVED");
  if (allApproved) {
    return { state: GATING_STATES.READY, reason: "all_docs_approved" };
  }

  // Pending (unresolved) docs take priority over partial approvals
  const hasPending = statuses.some((s) => PENDING_STATUSES.has(s));
  if (hasPending) {
    return { state: GATING_STATES.LOCKED, reason: "docs_pending_review" };
  }

  // Only partial approvals remain (no pending, no rejected, not all approved)
  const hasPartial = statuses.includes("PARTIALLY_APPROVED");
  if (hasPartial) {
    return {
      state: GATING_STATES.LOCKED_PARTIAL,
      reason: "partial_approval",
      note: "Prep and mobilization categories may proceed. Install dispatch is blocked until full approval.",
    };
  }

  return { state: GATING_STATES.READY, reason: "no_blocking_docs" };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function computeDocGatingForJob(jobId) {
  const docs = await fetchActiveLinkedDocStatuses(jobId);
  const gating = deriveGatingState(docs);
  return {
    ...gating,
    docCount:    docs.length,
    evaluatedAt: new Date().toISOString(),
  };
}

// Computes gating state and persists it to jobs.metadata.doc_gating.
// Called by document event handlers after any status-changing review action.
export async function evaluateAndPatchJobDocGating(jobId) {
  const gating = await computeDocGatingForJob(jobId);
  await patchJobDocGating(Number(jobId), gating);
  return gating;
}
