import eventBus from "../infrastructure/events/eventBus.js";
import { findAcceptedAndLate, markAssignmentGhosted } from "../modules/assignments/repository.js";

let ghostWatcherTimer = null;

function computeDelayUrgency(minutesLate) {
  return Number(minutesLate || 0) > 60 ? "CRITICAL" : "STANDARD";
}

// Single authoritative ghost-detection loop.
// Finds accepted assignments that are overdue and have no check-in log,
// marks them ghosted, then fires ON_GHOST_DETECTED so the orchestrator's
// ghost.handler.js can execute the emergency recovery sequence.
// dispatch.worker.js does NOT duplicate this detection — it handles offer expiry only.
export async function runGhostWatcherTick() {
  const candidates = await findAcceptedAndLate(15);

  for (const candidate of candidates) {
    const updated = await markAssignmentGhosted(candidate.id);
    if (!updated) continue;

    eventBus.emit("ON_GHOST_DETECTED", {
      assignmentId:    candidate.id,
      jobId:           candidate.job_id,
      workerUserId:    candidate.worker_user_id,
      contractorUserId: candidate.assigned_by,   // needed by ghost.handler.js → runAutofill
      detectedAt:      new Date().toISOString(),
      delayUrgency:    computeDelayUrgency(candidate.minutes_late)
    });
  }
}

export function startGhostWatcher() {
  if (ghostWatcherTimer) return;

  ghostWatcherTimer = setInterval(() => {
    runGhostWatcherTick().catch((error) => {
      console.error("[ghost-watcher] tick failed", error);
    });
  }, 5 * 60 * 1000);

  console.log("[ghost-watcher] started", { intervalMs: 5 * 60 * 1000 });
}
