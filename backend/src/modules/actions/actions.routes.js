import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import {
  draftDirectiveController,
  listDirectivesController,
  updateDirectiveStatusController,
} from "./actions.controller.js";

export const actionsRouter = Router();

actionsRouter.use(requireAuth);
actionsRouter.use(requireRole("contractor", "superintendent"));

// POST /api/actions/draft — create and mock-send a directive
actionsRouter.post("/draft", draftDirectiveController);

// GET /api/actions?jobId=:id — list directives for a job
actionsRouter.get("/", listDirectivesController);

// PATCH /api/actions/:id/status — update directive status (responded / ignored)
actionsRouter.patch("/:id/status", updateDirectiveStatusController);
