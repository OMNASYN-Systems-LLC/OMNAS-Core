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

function normalizePhotos(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  return [];
}

function deriveAssignedCategory(assignment, payload) {
  return payload.assignedCategory || assignment.trade_primary || "general";
}

function detectCategoriesFromText(text) {
  const source = String(text || "").toLowerCase();
  const rules = {
    electrical: ["wire", "panel", "conduit", "lighting"],
    plumbing: ["pipe", "fixture", "drain", "valve"],
    hvac: ["duct", "chiller", "air handler", "hvac"],
    concrete: ["slab", "rebar", "pour", "formwork"],
    sitework: ["grading", "excavation", "trench"]
  };

  const detected = [];

  for (const [category, keywords] of Object.entries(rules)) {
    const matches = keywords.filter((keyword) => source.includes(keyword));
    if (matches.length > 0) {
      detected.push({ category, confidence: Math.min(1, 0.45 + matches.length * 0.2) });
    }
  }

  return detected;
}

function stubTranscription(payload) {
  if (payload.text) {
    return String(payload.text);
  }

  if (payload.audioUrl) {
    return `Transcribed from audio: ${payload.audioUrl}`;
  }

  return "";
}

async function validateAssignmentForWorker(assignmentId, workerUserId) {
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

  return assignment;
}

export async function submitDailyLog(assignmentId, workerUserId, payload) {
  assertNonNegativeInteger(assignmentId, "assignmentId");
  assertRequiredFields(payload, ["logDate", "hoursWorked", "workSummary"]);

  const assignment = await validateAssignmentForWorker(assignmentId, workerUserId);

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
    jobId: assignment.job_id,
    workerUserId,
    assignedCategory: deriveAssignedCategory(assignment, payload),
    logDate: payload.logDate,
    hoursWorked: Number(payload.hoursWorked),
    crewSize: payload.crewSize ? Number(payload.crewSize) : null,
    workSummary: payload.workSummary,
    workCompleted: payload.workCompleted ?? payload.workSummary,
    issues: payload.issues ?? null,
    issuesBlockers: payload.issuesBlockers ?? payload.issues ?? null,
    weather: payload.weather ?? "manual_pending",
    photos: normalizePhotos(payload.photos),
    location: payload.location ?? null,
    autoSummary: payload.autoSummary ?? null,
    voiceTranscript: payload.voiceTranscript ?? null,
    detectedCategories: payload.detectedCategories ?? [],
    confidence: payload.confidence ?? null,
    estimatedHours: payload.estimatedHours ?? null,
    suggestedSummary: payload.suggestedSummary ?? null,
    submittedBy: workerUserId,
    isDraft: payload.isDraft ?? false
  });
}

export async function submitDailyLogEntry(workerUserId, payload) {
  assertRequiredFields(payload, ["assignmentId"]);
  const assignmentId = Number(payload.assignmentId);
  return submitDailyLog(assignmentId, workerUserId, {
    ...payload,
    logDate: payload.logDate || new Date().toISOString().slice(0, 10),
    workSummary: payload.workSummary || payload.workCompleted || "Field execution log",
    hoursWorked: payload.hoursWorked ?? payload.estimatedHours ?? 8
  });
}

export async function submitVoiceLog(workerUserId, payload) {
  assertRequiredFields(payload, ["assignmentId"]);

  const assignmentId = Number(payload.assignmentId);
  const assignment = await validateAssignmentForWorker(assignmentId, workerUserId);

  const transcript = stubTranscription(payload);
  const detected = detectCategoriesFromText(transcript);
  const topCategory = detected[0]?.category || deriveAssignedCategory(assignment, payload);
  const confidence = detected[0]?.confidence ?? 0.35;
  const estimatedHours = Number(payload.estimatedHours ?? 8);
  const suggestedSummary = transcript ? `Completed ${topCategory} activities based on voice log.` : "Field activities captured by voice.";

  const draft = await createDailyLog({
    assignmentId,
    jobId: assignment.job_id,
    workerUserId,
    assignedCategory: topCategory,
    logDate: payload.logDate || new Date().toISOString().slice(0, 10),
    hoursWorked: estimatedHours,
    crewSize: payload.crewSize ? Number(payload.crewSize) : null,
    workSummary: payload.workSummary || suggestedSummary,
    workCompleted: payload.workCompleted || suggestedSummary,
    issues: payload.issues || null,
    issuesBlockers: payload.issuesBlockers || null,
    weather: payload.weather || "auto_pending",
    photos: normalizePhotos(payload.photos),
    location: payload.location || null,
    autoSummary: suggestedSummary,
    voiceTranscript: transcript,
    detectedCategories: detected.map((item) => item.category),
    confidence,
    estimatedHours,
    suggestedSummary,
    submittedBy: workerUserId,
    isDraft: payload.isDraft ?? true
  });

  return {
    draft,
    prefill: {
      work_completed: suggestedSummary,
      detected_categories: detected.map((item) => item.category),
      estimated_hours: estimatedHours,
      suggested_summary: suggestedSummary
    }
  };
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

  const accessAssignment = {
    worker_user_id: log.worker_user_id || log.assignment_worker_user_id,
    assigned_by: log.assigned_by
  };

  ensureAssignmentAccess(accessAssignment, authUser);

  return log;
}
