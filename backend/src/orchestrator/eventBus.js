import { EventEmitter } from "events";

export const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);

export const EVENTS = {
  ON_GHOST_DETECTED:      "ON_GHOST_DETECTED",
  ON_ASSIGNMENT_ACCEPTED: "ON_ASSIGNMENT_ACCEPTED",
};
