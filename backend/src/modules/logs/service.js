import {
  createDailyLog,
  getAssignmentForLog,
  getLogByAssignmentAndDate,
  getLogById,
  listLogsForAssignment
} from "./repository.js";
import { assertNonNegativeInteger, assertRequiredFields } from "../../utils/validation.js";
import { recomputeReliability } from "../reliability/reliability.service.js";

// 🔥 AUTHORIZATION
function ensureAssignmentAccess(assignment, authUser) {
  if (authUser.role === "worker" && assignment.worker_user_id !== authUser.userId) {
    const error = new Error("Forbidden: Worker cannot access this assignment");
    error.statusCode = 403;
    throw error;
  }

  if (authUser.role === "contractor" && assignment.assigned_by !== authUser.userId) {
    const error = new Error("Forbidden: Contractor cannot access this assignment");
    error.statusCode = 403;
    throw error;
  }
}

// 🔥 CONSTRUCTION UTILITIES (AI + Field)
function normalizePhotos(value) {
  if (!value) return [];
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
    electrical: ["wire", "panel", "conduit", "lighting", "circuit"],
    plumbing: ["pipe", "fixture", "drain", "valve", "plumbing"],
    hvac: ["duct", "chiller", "air handler", "hvac", "vent"],
    concrete: ["slab", "rebar", "pour", "formwork", "concrete", "cement"],
    sitework: ["grading", "excavation", "trench", "earthwork", "backfill"],
    steel: ["weld", "beam", "column", "steel", "fabrication"],
    drywall: ["sheetrock", "drywall", "tape", "mud", "finish"]
  };

  const detected = [];
  for (const [category, keywords] of Object.entries(rules)) {
    const matches = keywords.filter(keyword => source.includes(keyword));
    if (matches.length > 0) {
      detected.push({ 
        category, 
        confidence: Math.min(1, 0.4 + matches.length * 0.15),
        matches: matches.length
      });
    }
  }
  return detected.slice(0, 3); // Top 3 categories
}

function stubTranscription(payload) {
  if (payload.text) return String(payload.text);
  if (payload.audioUrl) return `Transcribed from audio: ${payload.audioUrl}`;
  return "";
}

// 🔥 VALIDATION
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
    const error = new Error(`Assignment must be 'accepted' or 'active' to submit logs (current: ${assignment.status})`);
    error.statusCode = 409;
    throw error;
  }

  return assignment;
}

// 🔥 BASIC FORM LOG (office/mobile verified)
export async function submitDailyLog(assignmentId, workerUserId, payload) {
  assertNonNegativeInteger(assignmentId, "assignmentId");
  assertRequiredFields(payload, ["logDate", "hoursWorked", "workSummary"]);

  const assignment = await validateAssignmentForWorker(assignmentId, workerUserId);

  // Hours validation
  const hoursWorked = Number(payload.hoursWorked);
  if (hoursWorked < 0 || hoursWorked > 24) {
    const error = new Error("hoursWorked must be between 0 and 24");
    error.statusCode = 400;
    throw error;
  }

  // Duplicate prevention
  const existing = await getLogByAssignmentAndDate(assignmentId, payload.logDate);
  if (existing) {
    const error = new Error(`Log already exists for ${payload.logDate}`);
    error.statusCode = 409;
    throw error;
  }

  // 🔥 FULL CONSTRUCTION PAYLOAD
  const log = await createDailyLog({
    // Core
    assignmentId,
    jobId: assignment.job_id,
    workerUserId,
    assignedCategory: deriveAssignedCategory(assignment, payload),
    // Dates + time
    logDate: payload.logDate,
    hoursWorked,
    crewSize: payload.crewSize ? Number(payload.crewSize) : null,
    // Content
    workSummary: payload.workSummary,
    workCompleted: payload.workCompleted ?? payload.workSummary,
    issues: payload.issues ?? null,
    issuesBlockers: payload.issuesBlockers ?? payload.issues ?? null,
    // Field ops
    weather: payload.weather ?? "manual_pending",
    photos: normalizePhotos(payload.photos),
    location: payload.location ?? null,
    // AI Voice + OMNAS (optional)
    autoSummary: payload.autoSummary ?? null,
    voiceTranscript: payload.voiceTranscript ?? null,
    detectedCategories: payload.detectedCategories ?? [],
    confidence: payload.confidence ?? null,
    estimatedHours: payload.estimatedHours ?? null,
    suggestedSummary: payload.suggestedSummary ?? null,
    // Audit trail
    submittedBy: workerUserId,
    isDraft: payload.isDraft ?? false
  });

  // Fire-and-forget: refresh reliability score after each log submission
  // so anomaly signals (extreme hours, late submission, issue keywords) are reflected promptly
  if (!log.is_draft) {
    recomputeReliability(workerUserId).catch(() => {});
  }

  return log;
}

// 🔥 PROGRAMMATIC LOGS (mobile apps + integrations)
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

// 🔥 AI VOICE LOGGING (Construction Field Superpower!)
export async function submitVoiceLog(workerUserId, payload) {
  assertRequiredFields(payload, ["assignmentId"]);

  const assignmentId = Number(payload.assignmentId);
  const assignment = await validateAssignmentForWorker(assignmentId, workerUserId);

  // 🔥 VOICE TRANSCRIPTION + AI CATEGORIES
  const transcript = stubTranscription(payload);
  const detected = detectCategoriesFromText(transcript);
  const topCategory = detected[0]?.category || deriveAssignedCategory(assignment, payload);
  const confidence = detected[0]?.confidence ?? 0.35;
  const estimatedHours = Number(payload.estimatedHours ?? 8);
  
  const suggestedSummary = transcript 
    ? `Voice log: Completed ${topCategory} activities (${detected.length} categories detected).`
    : "Voice activities captured.";

  // 🔥 AUTO-FILL DRAFT w/ AI INSIGHTS
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
    weather: payload.weather || "voice_pending",
    photos: normalizePhotos(payload.photos),
    location: payload.location || null,
    // 🔥 AI ENRICHMENT
    autoSummary: suggestedSummary,
    voiceTranscript: transcript,
    detectedCategories: detected.map(item => item.category),
    confidence,
    estimatedHours,
    suggestedSummary,
    submittedBy: workerUserId,
    isDraft: payload.isDraft ?? true  // Voice logs start as drafts
  });

  return {
    draft,
    aiInsights: {
      topCategory,
      confidence,
      detectedCategories: detected,
      suggestedSummary
    },
    prefill: {
      work_completed: suggestedSummary,
      assigned_category: topCategory,
      detected_categories: detected.map(item => item.category),
      estimated_hours: estimatedHours
    }
  };
}

// 🔥 ASSIGNMENT LOG LISTING (w/ access control)
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

// 🔥 SINGLE LOG RETRIEVAL (w/ fallback access)
export async function getSingleLog(logId, authUser) {
  assertNonNegativeInteger(logId, "logId");

  const log = await getLogById(logId);
  if (!log) {
    const error = new Error("Log not found");
    error.statusCode = 404;
    throw error;
  }

  // 🔥 FLEXIBLE ACCESS (handles both log formats)
  const accessAssignment = {
    worker_user_id: log.worker_user_id || log.assignment_worker_user_id,
    assigned_by: log.assigned_by
  };

  ensureAssignmentAccess(accessAssignment, authUser);

  return log;
}