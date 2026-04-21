import eventBus from "../infrastructure/events/eventBus.js";

export function registerHandlers() {
  eventBus.on("ON_ASSIGNMENT_ACCEPTED", (payload) => {
    console.log("[ORCHESTRATOR] ON_ASSIGNMENT_ACCEPTED", {
      assignmentId: payload.assignmentId,
      jobId: payload.jobId,
      workerUserId: payload.workerUserId
    });
  });

  eventBus.on("ON_GHOST_DETECTED", (payload) => {
    console.log("[EVENT] ON_GHOST_DETECTED", payload);
  });

  eventBus.on("ON_MEETING_UPLOADED", (payload) => {
    console.log("[EVENT] ON_MEETING_UPLOADED", payload);
  });

  eventBus.on("ON_AUDIT_VERIFIED", (payload) => {
    console.log("[EVENT] ON_AUDIT_VERIFIED", payload);
  });
}
