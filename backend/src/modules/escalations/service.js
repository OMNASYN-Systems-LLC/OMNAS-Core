import { assertNonNegativeInteger } from "../../utils/validation.js";
import { findPendingByFingerprint, insertEscalation, listEscalations, updateEscalationStatus } from "./repository.js";

function normalizeEscalation(raw = {}) {
  return {
    taskId: String(raw.taskId || ""),
    zone: String(raw.zone || "SITE"),
    reason: String(raw.reason || "Escalation triggered"),
    ruleTriggered: String(raw.ruleTriggered || "manual_review"),
    severity: String(raw.severity || "AMBER"),
    suggestedAction: raw.suggestedAction ? String(raw.suggestedAction) : null,
    status: String(raw.status || "pending")
  };
}

export async function queueEscalations(events = []) {
  const created = [];
  for (const raw of events) {
    const escalation = normalizeEscalation(raw);
    if (!escalation.taskId) continue;

    const existing = await findPendingByFingerprint(escalation.taskId, escalation.zone, escalation.reason, escalation.ruleTriggered);
    if (existing) {
      created.push(existing);
      continue;
    }

    const row = await insertEscalation(escalation);
    if (row) created.push(row);
  }

  return created;
}

export async function getEscalationQueue(status = "pending") {
  const safeStatus = status === "resolved" ? "resolved" : status === "all" ? null : "pending";
  return listEscalations(safeStatus);
}

export async function recordEscalationDecision(id, decision, note) {
  assertNonNegativeInteger(id, "escalationId");

  const normalizedDecision = String(decision || "").toUpperCase();
  if (!["APPROVE", "MODIFY", "REJECT"].includes(normalizedDecision)) {
    const error = new Error("Decision must be APPROVE, MODIFY, or REJECT.");
    error.statusCode = 400;
    throw error;
  }

  const resolutionNote = note ? `${normalizedDecision}: ${note}` : normalizedDecision;
  const updated = await updateEscalationStatus(id, "resolved", resolutionNote);

  if (!updated) {
    const error = new Error("Escalation not found");
    error.statusCode = 404;
    throw error;
  }

  return updated;
}
