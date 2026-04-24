import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getJobCommandController } from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);
analyticsRouter.use(requireRole("contractor", "client", "superintendent"));

analyticsRouter.get("/:id/command", getJobCommandController);