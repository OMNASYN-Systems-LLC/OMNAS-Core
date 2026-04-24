import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getProjectDashboardController, getTriageDashboardController } from "./dashboard.controller.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireRole("contractor", "client"));
dashboardRouter.get("/triage", getTriageDashboardController);
dashboardRouter.get("/:id/dashboard", getProjectDashboardController);
