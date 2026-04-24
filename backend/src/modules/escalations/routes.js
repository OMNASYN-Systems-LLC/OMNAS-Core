import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { listEscalationsController, resolveEscalationController } from "./controller.js";

export const escalationsRouter = Router();

escalationsRouter.use(requireAuth, requireRole("contractor"));
escalationsRouter.get("/", listEscalationsController);
escalationsRouter.post("/:id/decision", resolveEscalationController);
