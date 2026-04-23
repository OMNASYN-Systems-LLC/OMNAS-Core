import {
  getComplianceState,
  upsertComplianceState,
  getWorkerCompanyCompliance,
  getExpiredCredentials,
  logBlockEvent,
  getComplianceHistory,
  getCompanyWorkerIds,
  getAllCompaniesWithStatus,
  getCompanyById,
  findActiveOverride,
  createOverride,
  listActiveOverrides
} from "./compliance.repository.js";
import eventBus from "../../infrastructure/events/eventBus.js";
import { EVENTS } from "../../orchestrator/eventBus.js";

// Machine-readable reason codes — kept in sync with audit_block_log.reason_code values
// and compliance.handler.js expectations.
export const BLOCK_REASON = {
  COMPANY_SUSPENDED:  "COMPANY_SUSPENDED",
  COMPANY_NOT_ACTIVE: "COMPANY_NOT_ACTIVE",
  CREDENTIAL_EXPIRED: "CREDENTIAL_EXPIRED"
};

const VALID_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"];

// --- Assignment acceptance guard ---

// Throws 403 when the worker's affiliated company is not ACTIVE.
// Returns null when the worker is unaffiliated (solo worker) or an active override exists.
// Every block is persisted to audit_block_log before throwing.
export async function checkAcceptanceEligibility(workerUserId, assignmentId) {
  const affiliation = await getWorkerCompanyCompliance(workerUserId);

  if (!affiliation) {
    return null; // solo worker — no company governance
  }

  const { company_id: companyId, compliance_status: status, company_name: companyName, reason } = affiliation;

  if (status === "ACTIVE") {
    return null; // clear
  }

  // Active override bypasses the block without touching the audit log.
  const override = await findActiveOverride(workerUserId, "ASSIGNMENT_ACCEPT");
  if (override) {
    return null; // waiver in effect
  }

  const isSuspended = status === "SUSPENDED";
  const reasonCode = isSuspended ? BLOCK_REASON.COMPANY_SUSPENDED : BLOCK_REASON.COMPANY_NOT_ACTIVE;

  const reasonDetail = isSuspended
    ? `Assignment acceptance blocked: company '${companyName}' is suspended.${reason ? ` Reason: ${reason}.` : ""} Contact your company administrator or OMNAS support.`
    : `Assignment acceptance blocked: company '${companyName}' has not been activated (current status: ${status ?? "PENDING"}). Compliance activation is required before workers can accept assignments.`;

  await logBlockEvent({
    blockType:     "ASSIGNMENT_ACCEPT",
    reasonCode,
    reasonDetail,
    entityType:    "assignment",
    entityId:      assignmentId,
    workerUserId,
    companyId,
    context: { assignmentId, complianceStatus: status ?? "PENDING" }
  });

  const err = new Error(reasonDetail);
  err.statusCode = 403;
  err.reasonCode  = reasonCode;
  throw err;
}

// --- Check-in guard ---

// Throws 403 when:
//   (a) the worker's company is SUSPENDED, OR
//   (b) the worker has any expired credential.
// Credential expiry is checked second so both issues can be surfaced progressively.
export async function checkCheckinEligibility(workerUserId, assignmentId) {
  const affiliation = await getWorkerCompanyCompliance(workerUserId);

  if (affiliation && affiliation.compliance_status === "SUSPENDED") {
    // Active CHECKIN override bypasses the company-suspended block.
    const override = await findActiveOverride(workerUserId, "CHECKIN");
    if (!override) {
      const reasonDetail = [
        `Check-in blocked: company '${affiliation.company_name}' is suspended.`,
        affiliation.reason ? `Reason: ${affiliation.reason}.` : "",
        "Workers cannot submit field logs while their company is suspended."
      ].filter(Boolean).join(" ");

      await logBlockEvent({
        blockType:     "CHECKIN",
        reasonCode:    BLOCK_REASON.COMPANY_SUSPENDED,
        reasonDetail,
        entityType:    "daily_log",
        entityId:      null,
        workerUserId,
        companyId:     affiliation.company_id,
        context:       { assignmentId, complianceStatus: "SUSPENDED" }
      });

      const err = new Error(reasonDetail);
      err.statusCode = 403;
      err.reasonCode  = BLOCK_REASON.COMPANY_SUSPENDED;
      throw err;
    }
  }

  const expired = await getExpiredCredentials(workerUserId);

  if (expired.length > 0) {
    // Active CHECKIN override bypasses credential expiry block.
    const override = await findActiveOverride(workerUserId, "CHECKIN");
    if (!override) {
      const types       = expired.map((c) => c.credential_type).join(", ");
      const reasonDetail = `Check-in blocked: expired credentials must be renewed before the next shift. Affected: ${types}.`;

      await logBlockEvent({
        blockType:     "CHECKIN",
        reasonCode:    BLOCK_REASON.CREDENTIAL_EXPIRED,
        reasonDetail,
        entityType:    "daily_log",
        entityId:      null,
        workerUserId,
        companyId:     affiliation?.company_id ?? null,
        context:       { assignmentId, expiredCredentials: expired }
      });

      const err = new Error(reasonDetail);
      err.statusCode = 403;
      err.reasonCode  = BLOCK_REASON.CREDENTIAL_EXPIRED;
      throw err;
    }
  }

  return null; // clear
}

// --- Compliance state management ---

export async function getCompanyComplianceStatus(companyId) {
  return getComplianceState(companyId);
}

// Validates, persists new status, appends history, and emits the appropriate event.
export async function setCompanyStatus(companyId, status, opts = {}) {
  if (!VALID_STATUSES.includes(status)) {
    const err = new Error(`Invalid compliance status '${status}'. Allowed: ${VALID_STATUSES.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }

  const company = await getCompanyById(companyId);
  if (!company) {
    const err = new Error("Company not found");
    err.statusCode = 404;
    throw err;
  }

  const state = await upsertComplianceState(companyId, status, opts);

  if (status === "ACTIVE") {
    eventBus.emit(EVENTS.ON_COMPANY_ACTIVATED, {
      companyId,
      changedBy: opts.changedBy ?? null
    });
  } else if (status === "SUSPENDED") {
    eventBus.emit(EVENTS.ON_COMPANY_SUSPENDED, {
      companyId,
      reason:    opts.reason ?? null,
      changedBy: opts.changedBy ?? null
    });
  }

  return state;
}

export async function getHistory(companyId) {
  return getComplianceHistory(companyId);
}

export async function listAllCompanies() {
  return getAllCompaniesWithStatus();
}

export async function getCompanyWorkers(companyId) {
  return getCompanyWorkerIds(companyId);
}

// --- Compliance override management ---

const VALID_OVERRIDE_TYPES = ["ASSIGNMENT_ACCEPT", "CHECKIN"];

export async function createComplianceOverride(authorizedBy, payload) {
  const { overrideType, reasonCode, reasonText, workerUserId, companyId, entityType, entityId, expiresAt } = payload ?? {};

  if (!VALID_OVERRIDE_TYPES.includes(overrideType)) {
    const err = new Error(`overrideType must be one of: ${VALID_OVERRIDE_TYPES.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }
  if (!reasonCode) {
    const err = new Error("reasonCode is required");
    err.statusCode = 400;
    throw err;
  }
  if (!workerUserId && !companyId) {
    const err = new Error("At least one of workerUserId or companyId is required");
    err.statusCode = 400;
    throw err;
  }
  if (!expiresAt || isNaN(Date.parse(expiresAt))) {
    const err = new Error("expiresAt is required and must be a valid ISO timestamp");
    err.statusCode = 400;
    throw err;
  }

  return createOverride({
    overrideType,
    reasonCode,
    reasonText:   reasonText   ?? null,
    workerUserId: workerUserId ?? null,
    companyId:    companyId   ?? null,
    entityType:   entityType  ?? null,
    entityId:     entityId    ?? null,
    authorizedBy,
    expiresAt
  });
}

export async function listComplianceOverrides(filters = {}) {
  return listActiveOverrides(filters);
}
