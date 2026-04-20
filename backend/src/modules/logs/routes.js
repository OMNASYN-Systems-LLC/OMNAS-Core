import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getAssignmentLogsController, getLogByIdController, submitDailyLogController } from "./controller.js";

export const assignmentLogsRouter = Router();
export const logsRouter = Router();

assignmentLogsRouter.use(requireAuth);
assignmentLogsRouter.post("/:id/logs", requireRole("worker"), submitDailyLogController);
assignmentLogsRouter.get("/:id/logs", getAssignmentLogsController);

logsRouter.use(requireAuth);
logsRouter.get("/:id", getLogByIdController);
