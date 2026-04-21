// Orchestrator service — manages urgency-aware vacancy re-fill with a retry cap.
//
// This service handles "business as usual" vacancy events (offer expired, manual
// rerun). Emergency ghost recovery flows through ghost.handler.js instead, which
// calls runAutofill directly with EMERGENCY options.
//
// runAutofill (assembler.service.js) already creates assignment offers internally,
// so this service consumes its result directly rather than iterating candidates.
import { getJobForRecommendations } from "../recommendations/repository.js";
import {
  getCurrentRetryCount,
  incrementRetryCountByJob
} from "../assignments/repository.js";
import { calculateUrgency, getExpansionParams } from "./urgency.engine.js";
import { runAutofill } from "./assembler.service.js";

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
  const params = getExpansionParams(urgency);

  // runAutofill creates offers and returns { summary, offered, fallback, skipped }.
  // Do NOT iterate candidates here — that would create duplicate offers.
  const result = await runAutofill(jobId, contractorUserId, {
    timeoutMinutes: params.timeoutMinutes,
  });

  const retryCount = await getCurrentRetryCount(jobId);

  if (result.summary.openSlots <= 0) {
    logTrace("no_open_slots", { jobId, urgency, reason });
    return {
      summary:  "No open slots",
      urgency,
      offered:  [],
      fallback: null,
      skipped:  true,
      retryCount
    };
  }

  logTrace("offers_created", {
    jobId,
    urgency,
    offered: result.offered.length,
    reason,
    retryCount
  });

  return {
    summary: result.offered.length > 0
      ? `Created ${result.offered.length} offer(s)`
      : "No offers created; fallback required",
    urgency,
    offered:  result.offered,
    fallback: result.fallback?.length > 0
      ? {
          fallbackCandidates:    result.fallback.map((f) => ({ workerUserId: f.workerId, score: f.score })),
          laborBridgeRecommended: urgency === "ghost" || urgency === "critical",
          manualAlertRequired:    true
        }
      : null,
    skipped:  false,
    retryCount
  };
}

export async function initDispatch(jobId, contractorUserId) {
  logTrace("dispatch_started", { jobId, contractorUserId });
  const { urgency } = await resolveUrgency(jobId, contractorUserId, false);
  return executeDispatch(jobId, contractorUserId, urgency, "init");
}

// Called by dispatch.worker.js for offer-expiry vacancies.
// NOT called for ghost events — those go through ghost.handler.js.
export async function handleVacancy(jobId, contractorUserId, reason = "vacancy") {
  const retryCount = await incrementRetryCountByJob(jobId);

  if (retryCount > 5) {
    logTrace("vacancy_rerun_skipped", { jobId, reason, retryCount });
    return {
      summary:  "Retry cap reached; manual intervention required",
      urgency:  "critical",
      offered:  [],
      fallback: { fallbackCandidates: [], laborBridgeRecommended: true, manualAlertRequired: true },
      skipped:  true,
      retryCount
    };
  }

  const { urgency } = await resolveUrgency(jobId, contractorUserId, false);
  logTrace("vacancy_rerun", { jobId, reason, urgency, retryCount });
  return executeDispatch(jobId, contractorUserId, urgency, reason);
}

export async function rerunDispatch(jobId, contractorUserId, overrides = {}) {
  const { urgency } = await resolveUrgency(jobId, contractorUserId, overrides.hasGhostSignal || false);
  const finalUrgency = overrides.urgencyLevel || urgency;
  logTrace("dispatch_rerun_manual", { jobId, finalUrgency, overrides });
  return executeDispatch(jobId, contractorUserId, finalUrgency, "manual_rerun");
}
