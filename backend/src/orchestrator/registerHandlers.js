import eventBus from "../infrastructure/events/eventBus.js";

export function registerHandlers() {
  eventBus.on("ON_ASSIGNMENT_ACCEPTED", (payload) => {
    console.log("[EVENT] ON_ASSIGNMENT_ACCEPTED", payload);
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
