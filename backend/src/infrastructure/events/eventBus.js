import { EventEmitter } from "events";

// Canonical singleton event bus for the entire OMNAS backend.
// Import this file wherever an event needs to be emitted or consumed.
// Use the default import: `import eventBus from ".../infrastructure/events/eventBus.js"`
const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

export default eventBus;