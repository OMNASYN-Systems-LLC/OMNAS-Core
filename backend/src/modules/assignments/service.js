import {
  createAssignment,
  getAssignmentById,
  getAssignmentByJobAndWorker,
  listAssignmentsForContractor,
  listAssignmentsForWorker,
  updateAssignmentStatus
} from "./repository.js";
import { assertNonNegativeInteger, assertRequiredFields } from "../../utils/validation.js";

function ensureStatus(assignment, allowed) {
  if (!allowed.includes(assignment.status)) {
    const error = new Error(`Invalid status transition from ${assignment.status}`);
    error.statusCode = 409;
    throw error;
  }
}

export async function createAssignmentOffer(contractorUserId, payload) {
  assertRequiredFields(payload, ["jobId", "workerUserId"]);
  assertNonNegativeInteger(payload.jobId, "jobId");

  const existing = await getAssignmentByJobAndWorker(payload.jobId, payload.workerUserId);
  if (existing) {
    const error = new Error("Worker is already assigned to this job");
    error.statusCode = 409;
    throw error;
  }

  return createAssignment({ jobId: payload.jobId, workerUserId: payload.workerUserId, assignedBy: contractorUserId });
}

export async function getAssignmentDetails(id, authUser) {
  assertNonNegativeInteger(id, "id");

  const assignment = await getAssignmentById(id);
  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = 404;
    throw error;
  }

  if (authUser.role === "worker" && assignment.worker_user_id !== authUser.userId) {
    const error = new Error("Forbidden assignment access");
    error.statusCode = 403;
    throw error;
  }

  if (authUser.role === "contractor" && assignment.assigned_by !== authUser.userId) {
    const error = new Error("Forbidden assignment access");
    error.statusCode = 403;
    throw error;
  }

  return assignment;
}

export async function acceptAssignment(id, workerUserId) {
  const assignment = await getAssignmentById(id);
  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = 404;
    throw error;
  }

  if (assignment.worker_user_id !== workerUserId) {
    const error = new Error("You can only accept your own assignments");
    error.statusCode = 403;
    throw error;
  }

  ensureStatus(assignment, ["offered"]);

  return updateAssignmentStatus(id, "accepted", { respondedAt: new Date().toISOString() });
}

export async function declineAssignment(id, workerUserId) {
  const assignment = await getAssignmentById(id);
  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = 404;
    throw error;
  }

  if (assignment.worker_user_id !== workerUserId) {
    const error = new Error("You can only decline your own assignments");
    error.statusCode = 403;
    throw error;
  }

  ensureStatus(assignment, ["offered"]);

  return updateAssignmentStatus(id, "declined", { respondedAt: new Date().toISOString() });
}

export async function startAssignment(id, workerUserId) {
  const assignment = await getAssignmentById(id);
  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = 404;
    throw error;
  }

  if (assignment.worker_user_id !== workerUserId) {
    const error = new Error("You can only start your own assignments");
    error.statusCode = 403;
    throw error;
  }

  ensureStatus(assignment, ["accepted"]);

  return updateAssignmentStatus(id, "active", { startedAt: new Date().toISOString() });
}

export async function completeAssignment(id, authUser) {
  const assignment = await getAssignmentById(id);
  if (!assignment) {
    const error = new Error("Assignment not found");
    error.statusCode = 404;
    throw error;
  }

  const allowed = assignment.worker_user_id === authUser.userId || assignment.assigned_by === authUser.userId;

  if (!allowed) {
    const error = new Error("You can only complete related assignments");
    error.statusCode = 403;
    throw error;
  }

  ensureStatus(assignment, ["active"]);

  return updateAssignmentStatus(id, "completed", { completedAt: new Date().toISOString() });
}

export async function listAssignments(authUser) {
  if (authUser.role === "worker") {
    return listAssignmentsForWorker(authUser.userId);
  }

  if (authUser.role === "contractor") {
    return listAssignmentsForContractor(authUser.userId);
  }

  return [];
}
