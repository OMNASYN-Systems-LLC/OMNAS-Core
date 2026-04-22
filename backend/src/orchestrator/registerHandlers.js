import { eventBus, EVENTS } from "./eventBus.js";
import { handleAssignmentAccepted } from "./handlers/calendar.handler.js";
import { handleGhostDetected } from "./handlers/ghost.handler.js";
import {
  handleDocApproved,
  handleDocPartiallyApproved,
  handleDocRejected,
} from "./handlers/document.handler.js";

export function registerHandlers() {
  // ON_ASSIGNMENT_ACCEPTED → create calendar shift block
  eventBus.on(EVENTS.ON_ASSIGNMENT_ACCEPTED, async (payload) => {
    console.log("[Orchestrator] ON_ASSIGNMENT_ACCEPTED", {
      assignmentId: payload.assignmentId,
      jobId: payload.jobId,
      workerUserId: payload.workerUserId,
    });
    await handleAssignmentAccepted(payload);
  });

  // ON_GHOST_DETECTED → emergency replacement sequence
  eventBus.on(EVENTS.ON_GHOST_DETECTED, async (payload) => {
    console.log("[Orchestrator] ON_GHOST_DETECTED:", JSON.stringify(payload));
    try {
      await handleGhostDetected(payload);
    } catch (err) {
      console.error("[Orchestrator] ghost handler error:", err.message);
    }
  });

  // Document review outcome → re-evaluate job doc-gating state
  eventBus.on(EVENTS.ON_DOC_APPROVED, async (payload) => {
    console.log("[Orchestrator] ON_DOC_APPROVED", { docId: payload.docId, jobId: payload.jobId });
    await handleDocApproved(payload);
  });

  eventBus.on(EVENTS.ON_DOC_PARTIALLY_APPROVED, async (payload) => {
    console.log("[Orchestrator] ON_DOC_PARTIALLY_APPROVED", { docId: payload.docId, jobId: payload.jobId });
    await handleDocPartiallyApproved(payload);
  });

  eventBus.on(EVENTS.ON_DOC_REJECTED, async (payload) => {
    console.log("[Orchestrator] ON_DOC_REJECTED", { docId: payload.docId, jobId: payload.jobId });
    await handleDocRejected(payload);
  });

  // Reserved for future packs
  eventBus.on(EVENTS.ON_MEETING_UPLOADED, (payload) => {
    console.log("[Orchestrator] ON_MEETING_UPLOADED", payload);
  });

  eventBus.on(EVENTS.ON_AUDIT_VERIFIED, (payload) => {
    console.log("[Orchestrator] ON_AUDIT_VERIFIED", payload);
  });
}