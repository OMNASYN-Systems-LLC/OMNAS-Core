// Bridge module: re-exports the canonical infrastructure singleton so that
// existing code using `import { eventBus } from "./orchestrator/eventBus.js"`
// and new code using `import eventBus from "...infrastructure/events/eventBus.js"`
// always share the same EventEmitter instance.
import eventBus from "../infrastructure/events/eventBus.js";

export { eventBus };

export const EVENTS = {
  ON_GHOST_DETECTED:      "ON_GHOST_DETECTED",
  ON_ASSIGNMENT_ACCEPTED: "ON_ASSIGNMENT_ACCEPTED",
  ON_MEETING_UPLOADED:    "ON_MEETING_UPLOADED",
  ON_AUDIT_VERIFIED:      "ON_AUDIT_VERIFIED",
  // Phase B — company governance
  ON_COMPANY_ACTIVATED:   "ON_COMPANY_ACTIVATED",
  ON_COMPANY_SUSPENDED:   "ON_COMPANY_SUSPENDED",
  ON_CREDENTIAL_EXPIRED:  "ON_CREDENTIAL_EXPIRED",
};
