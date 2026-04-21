import { assertRequiredFields, assertNonNegativeInteger } from "../../utils/validation.js";
import {
  insertDirective,
  markDirectiveSent,
  updateDirectiveStatus,
  listDirectivesForJob,
  findDirectiveById,
} from "./actions.repository.js";

const VALID_TARGET_ROLES = ["contractor", "worker", "superintendent", "client"];
const VALID_STATUSES = ["responded", "ignored"];

function formatDirective(row) {
  return {
    id: Number(row.id),
    jobId: Number(row.job_id),
    actionId: row.action_id,
    message: row.message,
    targetRole: row.target_role,
    status: row.status,
    createdBy: row.created_by,
    sentAt: row.sent_at,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Mock communication layer — no real transport in v1
function mockDispatch(directive) {
  return {
    channel: "mock",
    deliveredTo: directive.targetRole,
    reference: `MOCK-${directive.id}-${Date.now()}`,
  };
}

export async function draftAndSendDirective(payload, authUser) {
  assertRequiredFields(payload, ["jobId", "message", "targetRole"]);

  const jobId = Number(payload.jobId);
  assertNonNegativeInteger(jobId, "jobId");

  const targetRole = String(payload.targetRole || "").toLowerCase();
  if (!VALID_TARGET_ROLES.includes(targetRole)) {
    const err = new Error(`targetRole must be one of: ${VALID_TARGET_ROLES.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  const message = String(payload.message || "").trim();
  if (!message) {
    const err = new Error("message must not be empty");
    err.statusCode = 400;
    throw err;
  }

  const actionId = String(payload.actionId || "manual");

  const row = await insertDirective({
    jobId,
    actionId,
    message,
    targetRole,
    createdBy: authUser.userId,
  });

  // Mock send — immediately mark as sent, no real transport
  const sent = await markDirectiveSent(row.id);
  const dispatch = mockDispatch(sent);

  return {
    directive: formatDirective(sent),
    dispatch,
  };
}

export async function getDirectivesForJob(jobId) {
  assertNonNegativeInteger(jobId, "jobId");
  const rows = await listDirectivesForJob(jobId);
  return rows.map(formatDirective);
}

export async function setDirectiveStatus(id, status) {
  assertNonNegativeInteger(id, "id");

  if (!VALID_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  const row = await updateDirectiveStatus(id, status);
  if (!row) {
    const err = new Error("Directive not found");
    err.statusCode = 404;
    throw err;
  }

  return formatDirective(row);
}
