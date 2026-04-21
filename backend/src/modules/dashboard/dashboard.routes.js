import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getJobDashboardController } from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.use(requireRole("contractor", "client", "superintendent"));

dashboardRouter.get("/:id/dashboard", getJobDashboardController);
