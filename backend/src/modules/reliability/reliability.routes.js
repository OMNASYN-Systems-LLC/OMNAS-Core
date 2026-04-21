import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getWorkerReliabilityController } from "./reliability.controller.js";

export const reliabilityRouter = Router();

reliabilityRouter.use(requireAuth);

// Contractors use this during matching; workers can view their own score
reliabilityRouter.get(
  "/:id/reliability",
  requireRole("contractor", "worker", "superintendent"),
  getWorkerReliabilityController
);
