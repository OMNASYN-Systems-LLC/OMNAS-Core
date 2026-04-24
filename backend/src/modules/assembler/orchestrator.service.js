import { getJobForRecommendations } from "../recommendations/repository.js";
import { createAssignmentOffer } from "../assignments/service.js";
import {
  countOpenSlots,
  getCurrentRetryCount,
  incrementRetryCountByJob,
  getLiveWorkerIdsForJob
} from "../assignments/repository.js";
import { calculateTTL, calculateUrgency, getExpansionParams } from "./urgency.engine.js";
import { runAutofill } from "./assembler.service.js";

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60 * 1000);
}

function logTrace(event, payload) {
  console.log(`[dispatch-orchestrator] ${event}`, payload);
}

async function resolveUrgency(jobId, contractorUserId, hasGhostSignal = false) {
  const job = await getJobForRecommendations(jobId, contractorUserId);
  if (!job) {
    const error = new Error("Job not found");
    error.statusCode = 404;
    throw error;
  }

  const urgency = calculateUrgency(job.starts_at, new Date(), hasGhostSignal);
  return { urgency, job };
}

async function executeDispatch(jobId, contractorUserId, urgency, reason = "manual") {
  const openSlots = await countOpenSlots(jobId, contractorUserId);
  if (openSlots <= 0) {
    return { summary: "No open slots", urgency, offered: [], fallback: null, skipped: true, retryCount: await getCurrentRetryCount(jobId) };
  }

  const params = getExpansionParams(urgency);
  const ttlMinutes = calculateTTL(urgency);
  const autofill = await runAutofill(jobId, contractorUserId, params);

  const liveWorkerIds = new Set(await getLiveWorkerIdsForJob(jobId));
  const offered = [];
  for (const candidate of (autofill.candidates || []).slice(0, openSlots)) {
    if (liveWorkerIds.has(candidate.worker_user_id)) continue;

    const payload = {
      jobId,
      workerUserId: candidate.worker_user_id,
      expiresAt: ttlMinutes > 0 ? addMinutes(new Date(), ttlMinutes).toISOString() : null,
      urgencyLevel: urgency
    };

    const assignment = await createAssignmentOffer(contractorUserId, payload);
    offered.push(assignment);
  }

  const fallback = offered.length === 0 ? (autofill.fallback || {
    fallbackCandidates: (autofill.candidates || []).slice(0, 5).map((x) => ({ workerUserId: x.worker_user_id, score: x.total_score })),
    laborBridgeRecommended: params.allowGeneralLabor,
    manualAlertRequired: true
  }) : null;

  const retryCount = await getCurrentRetryCount(jobId);

  logTrace("offers_created", { jobId, urgency, offered: offered.length, reason, retryCount });

  return {
    summary: offered.length > 0 ? `Created ${offered.length} offer(s)` : "No offers created; fallback required",
    urgency,
    offered,
    fallback,
    skipped: false,
    retryCount
  };
}

export async function initDispatch(jobId, contractorUserId) {
  logTrace("dispatch_started", { jobId, contractorUserId });
  const { urgency } = await resolveUrgency(jobId, contractorUserId, false);
  return executeDispatch(jobId, contractorUserId, urgency, "init");
}

export async function handleVacancy(jobId, contractorUserId, reason = "vacancy") {
  const retryCount = await incrementRetryCountByJob(jobId);
  if (retryCount > 5) {
    logTrace("vacancy_rerun_skipped", { jobId, reason, retryCount });
    return {
      summary: "Retry cap reached; manual intervention required",
      urgency: "critical",
      offered: [],
      fallback: { fallbackCandidates: [], laborBridgeRecommended: true, manualAlertRequired: true },
      skipped: true,
      retryCount
    };
  }

  const { urgency } = await resolveUrgency(jobId, contractorUserId, reason === "ghost_detected");
  logTrace("vacancy_rerun", { jobId, reason, urgency, retryCount });
  return executeDispatch(jobId, contractorUserId, urgency, reason);
}

export async function rerunDispatch(jobId, contractorUserId, overrides = {}) {
  const { urgency } = await resolveUrgency(jobId, contractorUserId, overrides.hasGhostSignal || false);
  const finalUrgency = overrides.urgencyLevel || urgency;
  logTrace("dispatch_rerun_manual", { jobId, finalUrgency, overrides });
  return executeDispatch(jobId, contractorUserId, finalUrgency, "manual_rerun");
}
