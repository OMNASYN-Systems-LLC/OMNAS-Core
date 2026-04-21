import { Router } from "express";
import { getJobCommandController } from "./analytics.controller.js";
import { requireAuth } from "../../middleware/authContext.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);
analyticsRouter.get("/:id/command", getJobCommandController);
