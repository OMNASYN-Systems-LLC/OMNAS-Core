import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import {
  getJobCommandController,
  getFinancialSnapshotController,
  getJobActivitySnapshotController,
} from "./analytics.controller.js";

export const analyticsRouter = Router();

// 🔥 ENTERPRISE AUTH (merged best practices)
analyticsRouter.use(requireAuth);
analyticsRouter.use(requireRole("contractor", "client", "superintendent"));

// 🔥 CONSTRUCTION COMMAND ENDPOINT
analyticsRouter.get("/:id/command", getJobCommandController);

// 🔥 BONUS: Job financial snapshot (construction profit tracking)
analyticsRouter.get("/:id/financial", getFinancialSnapshotController);

// 🔥 Job activity snapshot (dashboard KPIs)
analyticsRouter.get("/:id/snapshot", getJobActivitySnapshotController);