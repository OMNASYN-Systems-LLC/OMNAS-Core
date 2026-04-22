// Dispatch worker — handles OFFER EXPIRY only.
//
// Ghost detection is intentionally absent here. The authoritative ghost
// detection path is: workers/ghostWatcher.js → ON_GHOST_DETECTED →
// orchestrator/handlers/ghost.handler.js → emergency runAutofill.
//
// This worker's sole job is to expire timed-out offers (where expires_at has
// elapsed) and trigger a normal vacancy re-fill via orchestrator.service.js.
import {
  listExpiredOffers,
  markAssignmentExpired
} from "../assignments/repository.js";
import { handleVacancy } from "./orchestrator.service.js";

let timer = null;

function trace(event, payload) {
  console.log(`[dispatch-worker] ${event}`, payload);
}

export async function runDispatchWorkerTick() {
  const expired = await listExpiredOffers();

  for (const assignment of expired) {
    await markAssignmentExpired(assignment.id);
    trace("offer_expired", { assignmentId: assignment.id, jobId: assignment.job_id });
    await handleVacancy(assignment.job_id, assignment.assigned_by, "offer_expired");
  }
}

export function startDispatchWorker() {
  if (timer) return;

  timer = setInterval(() => {
    runDispatchWorkerTick().catch((error) => {
      console.error("[dispatch-worker] tick failed", error);
    });
  }, 2 * 60 * 1000);

  trace("dispatch_worker_started", { intervalMs: 2 * 60 * 1000 });
}
