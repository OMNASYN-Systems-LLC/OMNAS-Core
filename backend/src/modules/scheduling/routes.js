import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getJobScheduleController } from "./controller.js";

export const schedulingRouter = Router();

schedulingRouter.use(requireAuth, requireRole("contractor"));
schedulingRouter.get("/:id/schedule", getJobScheduleController);
