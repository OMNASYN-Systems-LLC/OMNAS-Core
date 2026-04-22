import { createShiftBlockFromAssignmentEvent } from "../../modules/calendar/calendar.service.js";

export async function handleAssignmentAccepted(payload) {
  try {
    await createShiftBlockFromAssignmentEvent(payload || {});
  } catch (error) {
    console.error("[Orchestrator] calendar handler failed", error);
  }
}
