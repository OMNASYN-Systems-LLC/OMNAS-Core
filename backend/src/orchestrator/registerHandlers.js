import { eventBus, EVENTS } from "./eventBus.js";
import { handleAssignmentAccepted } from "./handlers/calendar.handler.js";
import { handleGhostDetected } from "./handlers/ghost.handler.js";
import {
  handleCompanyActivated,
  handleCompanySuspended,
  handleCredentialExpired
} from "./handlers/compliance.handler.js";

// Wraps an async event handler so an unhandled rejection can never crash the process.
function safe(label, fn) {
  return async (payload) => {
    try {
      await fn(payload);
    } catch (err) {
      console.error(`[Orchestrator] ${label} unhandled error:`, err.message);
    }
  };
}

export function registerHandlers() {
  eventBus.on(
    EVENTS.ON_ASSIGNMENT_ACCEPTED,
    safe("ON_ASSIGNMENT_ACCEPTED", async (payload) => {
      console.log("[Orchestrator] ON_ASSIGNMENT_ACCEPTED", {
        assignmentId: payload.assignmentId,
        jobId: payload.jobId,
        workerUserId: payload.workerUserId
      });
      await handleAssignmentAccepted(payload);
    })
  );

  eventBus.on(
    EVENTS.ON_GHOST_DETECTED,
    safe("ON_GHOST_DETECTED", async (payload) => {
      console.log("[Orchestrator] ON_GHOST_DETECTED:", JSON.stringify(payload));
      await handleGhostDetected(payload);
    })
  );

  eventBus.on(
    EVENTS.ON_COMPANY_ACTIVATED,
    safe("ON_COMPANY_ACTIVATED", async (payload) => {
      console.log("[Orchestrator] ON_COMPANY_ACTIVATED", payload);
      await handleCompanyActivated(payload);
    })
  );

  eventBus.on(
    EVENTS.ON_COMPANY_SUSPENDED,
    safe("ON_COMPANY_SUSPENDED", async (payload) => {
      console.log("[Orchestrator] ON_COMPANY_SUSPENDED", payload);
      await handleCompanySuspended(payload);
    })
  );

  eventBus.on(
    EVENTS.ON_CREDENTIAL_EXPIRED,
    safe("ON_CREDENTIAL_EXPIRED", async (payload) => {
      console.log("[Orchestrator] ON_CREDENTIAL_EXPIRED", payload);
      await handleCredentialExpired(payload);
    })
  );

  // Reserved for future packs
  eventBus.on(EVENTS.ON_MEETING_UPLOADED, (payload) => {
    console.log("[Orchestrator] ON_MEETING_UPLOADED", payload);
  });

  eventBus.on(EVENTS.ON_AUDIT_VERIFIED, (payload) => {
    console.log("[Orchestrator] ON_AUDIT_VERIFIED", payload);
  });
}