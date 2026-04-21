import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
// 🔥 FULL CONTROLLERS (merged both branches)
import {
  getAssignmentLogsController,
  getLogByIdController,
  submitDailyLogController,
  submitDailyLogEntryController,
  submitVoiceLogController
} from "./controller.js";

export const assignmentLogsRouter = Router();
export const logsRouter = Router();

// 🔥 ASSIGNMENT-SPECIFIC LOGS (per-job logging)
assignmentLogsRouter.use(requireAuth);
assignmentLogsRouter.post("/:id/logs", requireRole("worker"), submitDailyLogController);
assignmentLogsRouter.get("/:id/logs", getAssignmentLogsController);

// 🔥 GLOBAL LOG ENDPOINTS (voice + execution + single)
logsRouter.use(requireAuth);

// 📝 Form-based daily logs (office/mobile verified)
logsRouter.post("/daily", requireRole("worker"), submitDailyLogEntryController);

// 🎤 AI Voice logging (construction field workers - KILLER FEATURE!)
logsRouter.post("/voice", requireRole("worker"), submitVoiceLogController);

// 🔍 Single log retrieval (audit/compliance)
logsRouter.get("/:id", getLogByIdController);

// 🔥 CONTRACTOR REVIEW (read-only)
logsRouter.get("/:id/audit", requireRole("contractor", "client"), getLogByIdController);