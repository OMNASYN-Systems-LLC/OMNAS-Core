// Bridge module: re-exports the canonical infrastructure singleton so that
// existing code using `import { eventBus } from "./orchestrator/eventBus.js"`
// and new code using `import eventBus from "...infrastructure/events/eventBus.js"`
// always share the same EventEmitter instance.
import eventBus from "../infrastructure/events/eventBus.js";

export { eventBus };

export const EVENTS = {
  // Workforce / assignment lifecycle
  ON_GHOST_DETECTED:      "ON_GHOST_DETECTED",
  ON_ASSIGNMENT_ACCEPTED: "ON_ASSIGNMENT_ACCEPTED",
  ON_MEETING_UPLOADED:    "ON_MEETING_UPLOADED",
  ON_AUDIT_VERIFIED:      "ON_AUDIT_VERIFIED",

  // Document lifecycle (Pack 01) — emitted from documents.service.js
  // No downstream handlers registered yet; wiring deferred to Pack 02.
  ON_DOC_UPLOADED:           "ON_DOC_UPLOADED",
  ON_DOC_REVIEW_STARTED:     "ON_DOC_REVIEW_STARTED",
  ON_DOC_APPROVED:           "ON_DOC_APPROVED",
  ON_DOC_PARTIALLY_APPROVED: "ON_DOC_PARTIALLY_APPROVED",
  ON_DOC_REJECTED:           "ON_DOC_REJECTED",
  ON_DOC_SUPERSEDED:         "ON_DOC_SUPERSEDED",
};
