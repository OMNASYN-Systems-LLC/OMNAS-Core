import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/authContext.js";
import { getJobMatchesController } from "./controller.js";

export const matchingRouter = Router();

matchingRouter.use(requireAuth, requireRole("contractor"));
matchingRouter.get("/:id/matches", getJobMatchesController);
