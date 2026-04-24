import {
  listExpiredOffers,
  listGhostableAcceptedAssignments,
  markAssignmentExpired,
  markAssignmentGhosted
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

  const ghostables = await listGhostableAcceptedAssignments();
  for (const assignment of ghostables) {
    await markAssignmentGhosted(assignment.id);
    trace("ghost_detected", { assignmentId: assignment.id, jobId: assignment.job_id });
    await handleVacancy(assignment.job_id, assignment.assigned_by, "ghost_detected");
  }
}

export function startDispatchWorker() {
  if (timer) return;
  timer = setInterval(() => {
    runDispatchWorkerTick().catch((error) => {
      console.error("Dispatch worker tick failed", error);
    });
  }, 2 * 60 * 1000);

  trace("dispatch_worker_started", { intervalMs: 2 * 60 * 1000 });
}
