import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getProjectCommandController } from "./analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth, requireRole("contractor", "client"));
analyticsRouter.get("/:id/command", getProjectCommandController);
