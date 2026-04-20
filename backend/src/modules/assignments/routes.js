import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import {
  acceptAssignmentController,
  completeAssignmentController,
  createAssignmentController,
  declineAssignmentController,
  getAssignmentController,
  listAssignmentsController,
  startAssignmentController
} from "./controller.js";

export const assignmentsRouter = Router();

assignmentsRouter.use(requireAuth);
assignmentsRouter.post("/", requireRole("contractor"), createAssignmentController);
assignmentsRouter.get("/", listAssignmentsController);
assignmentsRouter.get("/:id", getAssignmentController);
assignmentsRouter.patch("/:id/accept", requireRole("worker"), acceptAssignmentController);
assignmentsRouter.patch("/:id/decline", requireRole("worker"), declineAssignmentController);
assignmentsRouter.patch("/:id/start", requireRole("worker"), startAssignmentController);
assignmentsRouter.patch("/:id/complete", completeAssignmentController);
