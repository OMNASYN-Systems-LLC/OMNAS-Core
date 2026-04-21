import { eventBus, EVENTS } from "./eventBus.js";
import { handleAssignmentAccepted } from "./handlers/calendar.handler.js";
import { handleGhostDetected } from "./handlers/ghost.handler.js";

export function registerHandlers() {
  // ON_ASSIGNMENT_ACCEPTED → create calendar shift block (Pack A)
  eventBus.on(EVENTS.ON_ASSIGNMENT_ACCEPTED, async (payload) => {
    console.log("[Orchestrator] ON_ASSIGNMENT_ACCEPTED", {
      assignmentId: payload.assignmentId,
      jobId:        payload.jobId,
      workerUserId: payload.workerUserId
    });
    await handleAssignmentAccepted(payload);
  });

  // ON_GHOST_DETECTED → emergency replacement sequence (Pack C)
  eventBus.on(EVENTS.ON_GHOST_DETECTED, async (payload) => {
    console.log("[Orchestrator] ON_GHOST_DETECTED:", JSON.stringify(payload));
    try {
      await handleGhostDetected(payload);
    } catch (err) {
      console.error("[Orchestrator] ghost handler error:", err.message);
    }
  });

  // Stubs — reserved for future packs
  eventBus.on(EVENTS.ON_MEETING_UPLOADED, (payload) => {
    console.log("[Orchestrator] ON_MEETING_UPLOADED", payload);
  });

  eventBus.on(EVENTS.ON_AUDIT_VERIFIED, (payload) => {
    console.log("[Orchestrator] ON_AUDIT_VERIFIED", payload);
  });
}
