import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import {
  getAssignmentLogsController,
  getLogByIdController,
  submitDailyLogController,
  submitDailyLogEntryController,
  submitVoiceLogController
} from "./controller.js";

export const assignmentLogsRouter = Router();
export const logsRouter = Router();

assignmentLogsRouter.use(requireAuth);
assignmentLogsRouter.post("/:id/logs", requireRole("worker"), submitDailyLogController);
assignmentLogsRouter.get("/:id/logs", getAssignmentLogsController);

logsRouter.use(requireAuth);
logsRouter.post("/daily", requireRole("worker"), submitDailyLogEntryController);
logsRouter.post("/voice", requireRole("worker"), submitVoiceLogController);
logsRouter.get("/:id", getLogByIdController);
