import { eventBus, EVENTS } from "./eventBus.js";
import { handleGhostDetected } from "./handlers/ghost.handler.js";

export function registerHandlers() {
  eventBus.on(EVENTS.ON_GHOST_DETECTED, async (payload) => {
    console.log("[Orchestrator] ON_GHOST_DETECTED:", JSON.stringify(payload));
    try {
      await handleGhostDetected(payload);
    } catch (err) {
      console.error("[Orchestrator] ghost handler error:", err.message);
    }
  });
}
