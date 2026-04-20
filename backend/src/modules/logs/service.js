import {
  createDailyLog,
  getAssignmentForLog,
  getLogByAssignmentAndDate,
  getLogById,
  listLogsForAssignment
} from "./repository.js";
import { assertNonNegativeInteger, assertRequiredFields } from "../../utils/validation.js";

function ensureAssignmentAccess(assignment, authUser) {
  if (authUser.role === "worker" && assignment.worker_user_id !== authUser.userId) {
    const error = new Error("Forbidden assignment log access");
    error.statusCode = 403;
    throw error;
  }

  if (authUser.role === "contractor" && assignment.assigned_by !== authUser.userId) {
    const error = new Error("Forbidden assignment log access");
    error.statusCode = 403;
    throw error;
  }
}

export async function submitDailyLog(assignmentId, workerUserId, payload) {
  assertNonNegativeInteger(assignmentId, "assignmentId");
  assertRequiredFields(payload, ["logDate", "hoursWorked", "workSummary"]);

  const assignment = await getAssignmentForLog(assignmentId);
  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = 404;
    throw error;
  }

  if (assignment.worker_user_id !== workerUserId) {
    const error = new Error("You can only submit logs for your own assignment");
    error.statusCode = 403;
    throw error;
  }

  if (!["accepted", "active"].includes(assignment.status)) {
    const error = new Error("Assignment must be accepted or active to submit logs");
    error.statusCode = 409;
    throw error;
  }

  if (Number(payload.hoursWorked) < 0 || Number(payload.hoursWorked) > 24) {
    const error = new Error("hoursWorked must be between 0 and 24");
    error.statusCode = 400;
    throw error;
  }

  const existing = await getLogByAssignmentAndDate(assignmentId, payload.logDate);
  if (existing) {
    const error = new Error("A log already exists for this assignment and date");
    error.statusCode = 409;
    throw error;
  }

  return createDailyLog({
    assignmentId,
    logDate: payload.logDate,
    hoursWorked: Number(payload.hoursWorked),
    workSummary: payload.workSummary,
    issues: payload.issues ?? null,
    submittedBy: workerUserId
  });
}

export async function getAssignmentLogs(assignmentId, authUser) {
  assertNonNegativeInteger(assignmentId, "assignmentId");

  const assignment = await getAssignmentForLog(assignmentId);
  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = 404;
    throw error;
  }

  ensureAssignmentAccess(assignment, authUser);

  return listLogsForAssignment(assignmentId);
}

export async function getSingleLog(logId, authUser) {
  assertNonNegativeInteger(logId, "logId");

  const log = await getLogById(logId);
  if (!log) {
    const error = new Error("Log not found");
    error.statusCode = 404;
    throw error;
  }

  ensureAssignmentAccess(log, authUser);

  return log;
}
