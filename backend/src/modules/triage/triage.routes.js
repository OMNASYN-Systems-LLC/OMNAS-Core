import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getTriageSummary, getEntityBlockLog } from "./triage.service.js";

export const triageRouter = Router();

triageRouter.use(requireAuth);
triageRouter.use(requireRole("contractor", "client", "superintendent"));

// GET /api/dashboard/triage
// Pilot decision surface: LOCKED_JOBS | COMPLIANCE_ALERTS | GHOST_EVENTS
// Designed for the GC / Prime to see everything that needs immediate attention.
triageRouter.get("/triage", async (req, res, next) => {
  try {
    const summary = await getTriageSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/triage/blocks/:entityType/:entityId
// Drill-down: full block-log for a specific assignment or daily_log.
triageRouter.get("/triage/blocks/:entityType/:entityId", async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const data = await getEntityBlockLog(entityType, entityId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
